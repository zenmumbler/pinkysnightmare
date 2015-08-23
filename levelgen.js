// Part of Pinky's Nightmare
// (c) 2015 by Arthur Langereis - @zenmumbler

var LEVEL_SCALE = 4.0;


function buildMapFromImageData(pix) {
	var inuse = 0, pixw = pix.width, pixh = pix.height;
	var data = pix.data, offset = 0, gridOffset = 0;
	
	var HEIGHT = 30.0;       // will appear inf high 
	
	var vertexes = [], normals = [], colors = [], cameras = [], grid = [];
	function vtx(x, y, z) { vertexes.push(x, y, z); }
	function nrm6(n) { for(var n=0; n<6; ++n) normals.push(n[0], n[1], n[2]); }
	
	var north = [0, 0, -1],
		west  = [-1, 0, 0],
		south = [0, 0, 1],
		east  = [1, 0, 0];

	for (var z=0; z < pixh; ++z) {
		for (var x=0; x < pixw; ++x) {
			if (data[offset] == 0) {
				var xa = x * LEVEL_SCALE,
					xb = (x+1) * LEVEL_SCALE,
					za = z * LEVEL_SCALE,
					zb = (z+1) * LEVEL_SCALE,
					h = HEIGHT;
				
				grid[gridOffset] = false;
				
				if (data[offset+1] > 200) {
					cameras.push(vec2.fromValues(x + .5, z + .5));
				}
				else {
					++inuse;
					grid[gridOffset] = true;
				
					// ccw
					// wall top
					vtx(xb, h, za);
					vtx(xb, 0, za);
					vtx(xa, 0, za);

					vtx(xa, 0, za);
					vtx(xa, h, za);
					vtx(xb, h, za);
				
					nrm6(north);

					// wall left
					vtx(xa, h, za);
					vtx(xa, 0, za);
					vtx(xa, 0, zb);

					vtx(xa, 0, zb);
					vtx(xa, h, zb);
					vtx(xa, h, za);

					nrm6(west);
				
					// wall bottom
					vtx(xa, h, zb);
					vtx(xa, 0, zb);
					vtx(xb, 0, zb);

					vtx(xb, 0, zb);
					vtx(xb, h, zb);
					vtx(xa, h, zb);

					nrm6(south);

					// wall right
					vtx(xb, h, zb);
					vtx(xb, 0, zb);
					vtx(xb, 0, za);
				
					vtx(xb, 0, za);
					vtx(xb, h, za);
					vtx(xb, h, zb);

					nrm6(east);
				}
			}

			offset += 4;
			gridOffset++;
		}
	}
	
	var wallColor = [32.0/255, 43.0/255, 222.0/255];
	for (var cx=0; cx < vertexes.length / 3; ++cx) {
		colors.push(wallColor[0], wallColor[1], wallColor[2]);
	}

	console.info("inuse", inuse);
	console.info("vtx", vertexes.length, "cam", cameras.length);

	return {
		cameras: cameras,
		grid: grid,
		gridW: pixw,
		gridH: pixh,
		mesh: new TriMesh(vertexes, normals, colors)
	};
}


function genMapMesh(then) {	
	var img = new Image();
	img.src = "level.png";
	img.onload = function() {
		var t0 = performance.now();
		var cvs = document.createElement("canvas");
		cvs.width = img.width;
		cvs.height = img.height;

		var ctx = cvs.getContext("2d");
		ctx.drawImage(img, 0, 0);
		var pix = ctx.getImageData(0, 0, cvs.width, cvs.height);
		var map = buildMapFromImageData(pix);
		var t1 = performance.now();
		
		console.info("mapGen took", (t1-t0).toFixed(2), "ms");
		
		then(map);
	};
}
