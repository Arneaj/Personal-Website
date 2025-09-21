// canvas

/***************************************************************************
 * Global variables
 ***************************************************************************/

import {
    starPositions,
    nb_stars,
    starPositionsCPUBuffer,
    starLastLikeCPUBuffer,
    starUserIDCPUBuffer,
    x_min,
    y_min,
    update_nb_stars,
    zoom
} from './globals.js';

/***************************************************************************
 * Imports
 ***************************************************************************/


function showError(errorText) {
    const errorBoxDiv = document.getElementById('error-box');
    if (!errorBoxDiv) {
        console.error(errorText);
        return;
    }
    const errorSpan = document.createElement('p');
    errorSpan.innerText = errorText;
    errorBoxDiv.appendChild(errorSpan);
    console.error(errorText);
}

export async function starsGraphics() {
    const canvas = document.getElementById('stars_canvas');
    if (!canvas) {
        showError("Canvas element not found!");
        return;
    }

    // 3) Setup WebGL
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        const isWebGl1Supported = !!document.createElement('canvas').getContext('webgl');
        if (isWebGl1Supported) {
            showError("WebGL 2 not supported, but WebGL 1 might be available.");
        } else {
            showError("No WebGL support at all in this browser/device.");
        }
        return;
    }

    // ----- Shaders -----
    const vertexShaderSource = `#version 300 es
    precision mediump float;
    in vec2 vertexPosition;
    out vec2 position;
    void main() {
        gl_Position = vec4(vertexPosition, 0.0, 1.0);
        position = vertexPosition;
    }`;

    const fragmentShaderSource = `#version 300 es
    precision mediump float;

    uniform float x_min;
    uniform float x_max_minus_x_min;
    uniform float y_min;
    uniform float y_max_minus_y_min;

    uniform int nb_stars;
    uniform vec2 star_positions[400];
    // uniform float star_last_likes[200];
    uniform int star_user_ids[200];

    uniform float smooth_current_time;
    uniform vec2 cursor_position;

    in vec2 position;
    out vec4 outputColor;

    void main() 
    {
        vec2 uv_cursor_position = cursor_position;

        // Convert from clip coords -> [0,1] -> map coordinates
        vec2 uv_position = vec2(
            position.x + 1.0,
            1.0 - position.y
        ) * 0.5;
        uv_position *= vec2(x_max_minus_x_min, y_max_minus_y_min);
        uv_position += vec2(x_min, y_min);

        float d;
        float delta_time;
        float time_falloff;

        vec2 uv_star_position;
        outputColor = vec4(0.0, 0.0, 0.0, 1.0);

        int closest_star_user_id = -1;
        float d_cursor_star_min = 100.0;

        for (int i = 0; i < nb_stars; i++) 
        {
            uv_star_position = star_positions[i];
            d = max(0.1, distance(uv_position, uv_star_position));

            float d_cursor_star = distance(uv_cursor_position, uv_star_position);

            if (d_cursor_star < d_cursor_star_min)
            {
                d_cursor_star_min = d_cursor_star;
                closest_star_user_id = star_user_ids[i];
            }

            outputColor.xyz += (1.0 + 0.1 * sin(mod(10.0 * smooth_current_time, 6.28318530718)))
                            *  vec3(1.0, 0.8, 0.6) // 
                            /  pow(d * 0.0005, 1.8);
        }

        float d_from_cursor = max(1000.0, 1000.0 * distance(uv_cursor_position, uv_position));
        outputColor.xyz /= max(20000.0, pow(d_from_cursor, 1.0));

        if (closest_star_user_id == -1) return;

        int last_star_index;

        for (int i = 0; i < nb_stars; i++)
        {
            if (star_user_ids[i] != closest_star_user_id) continue;

            last_star_index = i;
            break;
        }

        for (int i = last_star_index+1; i < nb_stars; i++)
        {
            if (star_user_ids[i] != closest_star_user_id) continue;

            vec2 ray_vec = star_positions[i] - star_positions[last_star_index];
            float ray_length = max(0.1, length(ray_vec));

            vec2 ray_dir = ray_vec / ray_length;
            vec2 ray_normal = vec2(-ray_dir.y, ray_dir.x);

            float dist_n = dot(ray_normal, uv_position - star_positions[last_star_index]);

            if (abs(dist_n) > 5.0) 
            {
                last_star_index = i;
                continue;
            }
            
            float dist_u = dot(ray_dir, uv_position - star_positions[last_star_index]);

            if (dist_u > ray_length || dist_u <= 0.0) 
            {
                last_star_index = i;
                continue;
            }

            float n_offset = abs(dist_n)*0.2;
            float u_offset = min(dist_u, ray_length - dist_u) / ray_length;

            outputColor.xyz += (1.0 + 0.1 * sin(mod(10.0 * smooth_current_time, 6.28318530718)))
                           * vec3(1.0, 0.9, 1.0)
                           * pow((1.0 - n_offset - u_offset), 3.0)
                           / max(0.5, pow(d_cursor_star_min*0.1, 1.8));

            last_star_index = i;
        }

    }`;

    // Compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        showError("Vertex shader compile error: " + gl.getShaderInfoLog(vertexShader));
        return;
    }

    // Compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        showError("Fragment shader compile error: " + gl.getShaderInfoLog(fragmentShader));
        return;
    }

    // Link program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        showError("Shader link error: " + gl.getProgramInfoLog(program));
        return;
    }

    // Full-screen quad
    const quadVerts = new Float32Array([
        -1, 1, 
        -1,-1, 
         1,-1, 
         1, 1
    ]);
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    update_nb_stars(starPositions.length / 2);

    // Uniform locations
    const starUniform = gl.getUniformLocation(program, "star_positions");
    // const starLastLikeUniform = gl.getUniformLocation(program, "star_last_likes");
    const starUserIDUniform = gl.getUniformLocation(program, "star_user_ids");

    // const timeUniform = gl.getUniformLocation(program, "current_time");
    const smoothTimeUniform = gl.getUniformLocation(program, "smooth_current_time");

    const starCountUniform = gl.getUniformLocation(program, "nb_stars");

    const xMinUniform = gl.getUniformLocation(program, "x_min");
    const xMaxMinusXMinUniform = gl.getUniformLocation(program, "x_max_minus_x_min");
    const yMinUniform = gl.getUniformLocation(program, "y_min");
    const yMaxMinusYMinUniform = gl.getUniformLocation(program, "y_max_minus_y_min");

    const cursorUniform = gl.getUniformLocation(program, "cursor_position");

    // Attribute location
    const positionAttribLoc = gl.getAttribLocation(program, "vertexPosition");
    if (positionAttribLoc < 0) {
        showError("Failed to get vertexPosition attribute location!");
        return;
    }

    // Setup viewport
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.clearColor(0.08, 0.08, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, canvas.width, canvas.height);

    let cursorX = 0, cursorY = 0;
    window.addEventListener("mousemove", (e) => {
        cursorX = e.clientX;
        cursorY = e.clientY;
    });  
    
    function drawFrame() {  
        gl.useProgram(program);
        gl.enableVertexAttribArray(positionAttribLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.vertexAttribPointer(
            positionAttribLoc,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );

        let smooth_time = performance.now() * 0.001;

        gl.uniform1f(xMinUniform, (x_min + 0.5 * canvas.clientWidth * (1 - zoom)));
        gl.uniform1f(xMaxMinusXMinUniform, canvas.clientWidth*zoom);
        gl.uniform1f(yMinUniform, (y_min + 0.5 * canvas.clientHeight * (1 - zoom)));
        gl.uniform1f(yMaxMinusYMinUniform, canvas.clientHeight*zoom);

        gl.uniform2f(
            cursorUniform, 
            cursorX*zoom + (x_min + 0.5 * canvas.clientWidth * (1 - zoom)), 
            cursorY*zoom + (y_min + 0.5 * canvas.clientHeight * (1 - zoom))
        );

        // gl.uniform1f(timeUniform, Date.now() * 0.001 - 1735689600.0);  // seconds since 01/01/2025
        gl.uniform1f(smoothTimeUniform, smooth_time);  // seconds since program started. Used for smooth animations.

        gl.uniform1i(starCountUniform, nb_stars);
        
        if (nb_stars > 0) {
            gl.uniform2fv(starUniform, starPositionsCPUBuffer);
            // gl.uniform1fv(starLastLikeUniform, starLastLikeCPUBuffer);
            gl.uniform1iv(starUserIDUniform, starUserIDCPUBuffer);
        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        requestAnimationFrame(drawFrame);
    }
    requestAnimationFrame(drawFrame);
}


/***************************************************************************
 * Star popup message handling
 ***************************************************************************/

var speed_x = 0;
var speed_y = 0;

var mouseHoldTimeout = null;
var mouseDownDone = false;

// Dragging logic
// window.addEventListener("mousedown", mouseDown);
// window.addEventListener("mousemove", mouseDownAndMove);
// window.addEventListener("mouseup", () => {
//     mouseDownDone = false;
//     last_x = null;
//     last_y = null;
//     last_t = null;
// });

export function mouseDown() {
}

var last_x = null;
var last_y = null;
var last_t = null;

export function mouseDownAndMove(event) {
    
}

export function stopOnMouseLeave(event) {
    mouseHoldTimeout = null;
    mouseDownDone = false;
}


/**
 * When the user clicks the canvas:
 *  - If they do a quick click, we open the "Add star" box.
 *  - If they were dragging, we skip it.
 */
export function clickFunction(event) {
    // Cancel any pending hold
    if (mouseHoldTimeout) {
        clearTimeout(mouseHoldTimeout);
        mouseHoldTimeout = null;
    }
    // If it was a long press/drag, reset and do nothing
    if (mouseDownDone) {
        mouseDownDone = false;
        last_x = null;
        last_y = null;
        last_t = null;
        return;
    }

    const infoBox = document.getElementById('info');
    if (!infoBox) return;

    let canvas = document.getElementById('stars_canvas');

    let x = event.clientX*zoom + (x_min + 0.5 * canvas.clientWidth * (1 - zoom));
    let y = event.clientY*zoom + (y_min + 0.5 * canvas.clientHeight * (1 - zoom));

    // The box might be visible, so forcibly hide first
    infoBox.style.animation = "0.2s smooth-disappear ease-out";
    infoBox.style.opacity = "0";

    if (infoBox.style.visibility === "hidden") 
    {
        infoBox.innerHTML = `
            <b>Add a star</b><br><br>
            <input type="text" id="star_message" class="button message_input" placeholder="Star message..."><br>
            <b>(max 256 characters)</b>
            <br><br>
            <button id="submit_button" class="button submit_button">Submit message</button>
            <button id="close_star_box" class="button close_button">Close</button>
        `;
        const submitBtn = infoBox.querySelector("#submit_button");
        // submitBtn?.addEventListener("click", submitMessage);
    }
    else 
    {
        infoBox.innerHTML += `
            <br><br>
            <button id="like_button" class="button like_button">Like</button>
            <button id="dislike_button" class="button dislike_button">Dislike</button>
            <button id="close_star_box" class="button close_button">Close</button>
        `;
        // const likeBtn = infoBox.querySelector("#like_button");
        // likeBtn?.addEventListener("click", likeMessage);
        // const dislikeBtn = infoBox.querySelector("#dislike_button");
        // dislikeBtn?.addEventListener("click", dislikeMessage);
    }
    infoBox.style.visibility = "visible";
    infoBox.style.animation = "0.2s smooth-appear ease-in";
    infoBox.style.opacity = "1";
    infoBox.style.backgroundColor = "rgba(51, 51, 51, 0.95)";
    infoBox.style.top = "40%";
    infoBox.style.left = "25%";
    infoBox.style.width = "50%";

    // Attach listeners to the close buttons
    // const closeBtn = infoBox.querySelector("#close_star_box");
    // closeBtn?.addEventListener("click", async () => {
    //     await closeStarPopup(event);
    // });
}




