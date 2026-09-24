/** A single, crease-aware smoothing pass over vertex normals, never positions.
 * Neighbours more than 60 degrees apart are excluded so opposite fold faces
 * don't cancel each other. Input normals are unit length from Three.js.
 */
export function softenGridNormals(normals: Float32Array, segmentsX: number, segmentsY: number, scratch: Float32Array) {
  const width = segmentsX + 1;
  for (let y = 0; y <= segmentsY; y++) for (let x = 0; x <= segmentsX; x++) {
    const i = y * width + x, k = i * 3;
    const cx = normals[k], cy = normals[k + 1], cz = normals[k + 2];
    let nx = cx * 2, ny = cy * 2, nz = cz * 2;
    for (let d = 0; d < 4; d++) {
      if ((d === 0 && x === 0) || (d === 1 && x === segmentsX) || (d === 2 && y === 0) || (d === 3 && y === segmentsY)) continue;
      const j = (i + (d === 0 ? -1 : d === 1 ? 1 : d === 2 ? -width : width)) * 3;
      const dot = cx * normals[j] + cy * normals[j + 1] + cz * normals[j + 2];
      if (dot > .5) { nx += normals[j]; ny += normals[j + 1]; nz += normals[j + 2]; }
    }
    const length = Math.hypot(nx, ny, nz);
    scratch[k] = length > 1e-8 ? nx / length : cx;
    scratch[k + 1] = length > 1e-8 ? ny / length : cy;
    scratch[k + 2] = length > 1e-8 ? nz / length : cz;
  }
  normals.set(scratch);
}
