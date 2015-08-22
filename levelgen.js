function buildMapFromImageData(pix) {
	var inuse = 0, w = pix.width, h = pix.height;
	var data = pix.data, offset = 0;
	
	var SCALE = 2;
	var HEIGHT = 30;       // will appear inf high 
	
	var vertexes = [], normals = [], colors = [];
	function vtx(x, y, z) { vertexes.push(x, y, z); }
	function nrm6(n) { for(var n=0; n<6; ++n) normals.push(n[0], n[1], n[2]); }
	
	var north = [0, 0, -1],
		west  = [-1, 0, 0],
		south = [0, 0, 1],
		east  = [1, 0, 0];

	for (var z=0; z < h; ++z) {
		for (var x=0; x < w; ++x) {
			if (data[offset + 3] > 0) {
				++inuse;
				
				var xa = x * SCALE,
					xb = (x+1) * SCALE,
					za = z * SCALE;
					zb = (z+1) * SCALE,
					h = HEIGHT * SCALE;
				
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

			offset += 4;
		}
	}
	
	var wallColor = [32.0/255, 43.0/255, 222.0/255];
	for (var cx=0; cx < vertexes.length / 3; ++cx) {
		colors.push(wallColor[0], wallColor[1], wallColor[2]);
	}

	console.info("inuse", inuse);
	console.info("vtx", vertexes.length);

	return new TriMesh(vertexes, normals, colors);
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
		
		console.info("mapGen took", t1-t0, "ms");
		
		then(map);
	};
}
