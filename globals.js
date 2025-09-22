// globals.js

export let starIDs = [1, 2, 3];        // starIDs[i] => star's integer ID
export let starPositions = [800,500, 100,300, 260,200];  // starPositions[2*i], starPositions[2*i + 1] => star's X & Y
export let starMessages = [];   // starMessages[i] => string or null
// export let starLastLikeTime = [
//     Date.now() * 0.001 - 1735689600 - 10,  // some star added 10s ago
//     Date.now() * 0.001 - 1735689600 - 3600,  // some star added 1h ago
//     Date.now() * 0.001 - 1735689600 - 6*3600,  // some star added 6h ago
//     Date.now() * 0.001 - 1735689600 - 12*3600,  // some star added 12h ago
//     Date.now() * 0.001 - 1735689600 - 18*3600,  // some star added 18 ago
//     Date.now() * 0.001 - 1735689600 - 24*3600,  // some star added 24h ago
//     Date.now() * 0.001 - 1735689600 - 12*3600,  // some star added 24h ago
//     Date.now() * 0.001 - 1735689600 - 12*3600  // some star added 24h ago
// ];  // starCreationTime[i] => star's UNIX time of last like or creation.
// // TEMPORARY initialising the stars with fixed values, only 6 for now
export let starLastLikeTime = [];
export let starUserID = [1, 1, 2];
// export const starUserID = [0, 1, 0, 1, 1, 2, 0, 1];
export let nb_stars = 3;
export let starCreationDate = [];
export let starUsername = [];

export let starPositionsCPUBuffer = new Float32Array(starPositions);
export let starLastLikeCPUBuffer = new Float32Array(starLastLikeTime);
export let starUserIDCPUBuffer = new Int32Array(starUserID);


export let x_min = 0;
export let y_min = 0;

export let zoom = 1.0;

export let zoomed_x_min = x_min;
export let zoomed_y_min = y_min;
export let zoomed_x_span = null;
export let zoomed_y_span = null;

export const total_map_pixels = 10000;

export const MAX_STARS = 1000;
export const RECONNECTION_TIMEOUT = 3000;

export function updateLists(list_of_lists)
{
    [starIDs, starMessages, starLastLikeTime, starUserID, starUsername, starPositions] = list_of_lists;
}

/**
 * Helper to update the Float32Array whenever starPositions changes.
 */
export function updateStarPositionsBuffer() {
    nb_stars = starPositions.length / 2;
    starPositionsCPUBuffer = new Float32Array(starPositions);
    starLastLikeCPUBuffer = new Float32Array(starLastLikeTime);
    starUserIDCPUBuffer = new Int32Array(starUserID);
}

/**
 * Check if a star at (x, y) is currently in the viewport.
 */
export function isInViewport(canvas, x, y) {
    const left   = x_min;
    const right  = x_min + (canvas?.clientWidth || 0);
    const bottom = y_min;
    const top    = y_min + (canvas?.clientHeight || 0);
    return (x >= left && x <= right && y >= bottom && y <= top);
}

/** Setter function for x_min and y_min */
export function updateMinCoords(newXMin, newYMin) {
    x_min = newXMin;
    y_min = newYMin;
}

/** Setter function for nb_stars */
export function update_nb_stars(newNbStars) {
    nb_stars = newNbStars;
}
