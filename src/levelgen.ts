// Part of Pinky's Nightmare
// (c) 2015-6 by Arthur Langereis - @zenmumbler

const LEVEL_SCALE = 4.0;

interface vec2 {
	equals(a: sd.Float2, b: sd.Float2): boolean;
}

vec2.equals = function(a, b) {
	return a[0] == b[0] && a[1] == b[1];
};

interface CameraMarker extends sd.Float2 {
	doorCam?: boolean;
}

interface MapData {
	cameras: CameraMarker[];
	grid: boolean[];
	path: boolean[];
	gridW: number;
	gridH: number;
	mesh: render.Mesh;
	cornerColors: sd.Float3[];
}


function buildMapFromImageData(rctx: render.RenderContext, pix: ImageData): MapData {
	var inuse = 0, pixw = pix.width, pixh = pix.height;
	var data = pix.data, offset = 0, gridOffset = 0;
	var mapMesh = new mesh.MeshData(mesh.AttrList.Pos3Norm3Colour3());
	mapMesh.indexBuffer = null;

	const HEIGHT = 25.0;       // will appear inf high
	
	var vertexes: mesh.VertexBufferAttributeView,
		normals: mesh.VertexBufferAttributeView,
		colors: mesh.VertexBufferAttributeView,
		vtxIx = 0,
		normIx = 0,
		colIx = 0,
		cameras: CameraMarker[] = [],
		grid: boolean[] = [],
		path: boolean[] = [];


	function vtx(x: number, y: number, z: number) {
		vec3.set(vertexes.item(vtxIx), x, y, z);
		++vtxIx;
	}
	function nrm6(nrm: sd.Float3) {
		for (var n = 0; n < 6; ++n) {
			vec3.copy(normals.item(normIx++), nrm);
		}
	}
	function col6(colT: sd.Float3, colB: sd.Float3) {
		vec3.copy(colors.item(colIx + 0), colT);
		vec3.copy(colors.item(colIx + 1), colB);
		vec3.copy(colors.item(colIx + 2), colB);

		vec3.copy(colors.item(colIx + 3), colB);
		vec3.copy(colors.item(colIx + 4), colT);
		vec3.copy(colors.item(colIx + 5), colT);
		colIx += 6;
	}
	
	const north = [0, 0, -1],        // normals of the sides
		west  = [-1, 0, 0],
		south = [0, 0, 1],
		east  = [1, 0, 0];
	
	const corners = [
		[0, 0],
		[pixw, 0],
		[0, pixh],
		[pixw, pixh]
	];

	const cornerColors = [
		u8Color(32, 43, 222),
		u8Color(255, 184, 71),
		u8Color(255, 37, 0),
		u8Color(0, 252, 222),

		u8Color(0xff, 0xd7, 0x00)  // homebase
	];
	
	const topDarkenFactor = 0.65,
		  botDarkenFactor = 0.30;    // bottom vertices are darker than top ones
	
	// home base in the grid
	const homeBaseMin = [21,26],
		  homeBaseMax = [35,34];
	const doorCameraLoc = [28,23];

	// preflight scan for wall cells
	offset = 0;
	for (var z = 0; z < pixh; ++z) {
		for (var x = 0; x < pixw; ++x) {
			if ((data[offset + 1] == 0) && (data[offset + 2] == 0)) {
				++inuse;
			}
			offset += 4;
		}
	}

	mapMesh.primaryVertexBuffer.allocate(inuse * 6 * 4);
	mapMesh.primitiveGroups.push({
		fromPrimIx: 0,
		primCount: inuse * 2 * 4,
		materialIx: 0
	});
	vertexes = new mesh.VertexBufferAttributeView(mapMesh.primaryVertexBuffer, mapMesh.primaryVertexBuffer.attrByRole(mesh.VertexAttributeRole.Position)),
	normals = new mesh.VertexBufferAttributeView(mapMesh.primaryVertexBuffer, mapMesh.primaryVertexBuffer.attrByRole(mesh.VertexAttributeRole.Normal)),
	colors = new mesh.VertexBufferAttributeView(mapMesh.primaryVertexBuffer, mapMesh.primaryVertexBuffer.attrByRole(mesh.VertexAttributeRole.Colour)),

	// create walls and populate logic grids
	offset = 0;
	for (var z = 0; z < pixh; ++z) {
		for (var x = 0; x < pixw; ++x) {
			grid[gridOffset] = false;
			path[gridOffset] = false;
			
			if ((data[offset+0] != 0 && data[offset+0] != 255) ||
				(data[offset+1] != 0 && data[offset+1] != 255) ||
				(data[offset+2] != 0 && data[offset+2] != 255)) {
				console.info(x, z, data[offset], data[offset+1], data[offset+2], data[offset+3]);
			}

			if (data[offset] == 0) {
				var xa = x * LEVEL_SCALE,
					xb = (x+1) * LEVEL_SCALE,
					za = z * LEVEL_SCALE,
					zb = (z+1) * LEVEL_SCALE,
					h = HEIGHT;
				
				if (data[offset+2] == 255) {
					path[gridOffset] = true;
				}
				
				if (data[offset+1] == 255) {
					if (vec2.equals([x,z], doorCameraLoc)) {
						var dc = <CameraMarker>(vec2.fromValues(x + .5, z + .1));
						dc.doorCam = true;
						cameras.push(dc);
					}
					else {
						cameras.push(vec2.fromValues(x + .5, z + .5));
					}
				}

				if ((data[offset+1] == 0) && (data[offset+2] == 0)) {
					grid[gridOffset] = true;
					
					// determine color to use
					var topColor = vec3.create();
					var botColor = vec3.create();

					if (x >= homeBaseMin[0] && x <= homeBaseMax[0] && z >= homeBaseMin[1] && z <= homeBaseMax[1]) {
						vec3.copy(topColor, cornerColors[4]);
						vec3.scale(botColor, topColor, 0.6);
					}
					else {
						// calculate interpolated color by distance from the 4 corners of the field
						var cornerDist = vec4.create();
						cornerDist[0] = vec2.squaredDistance(corners[0], [x, z]);
						cornerDist[1] = vec2.squaredDistance(corners[1], [x, z]);
						cornerDist[2] = vec2.squaredDistance(corners[2], [x, z]);
						cornerDist[3] = vec2.squaredDistance(corners[3], [x, z]);
					
						vec4.normalize(cornerDist, cornerDist);
					
						cornerDist[0] = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist[0])), 2);
						cornerDist[1] = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist[1])), 2);
						cornerDist[2] = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist[2])), 2);
						cornerDist[3] = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist[3])), 2);
					
						vec3.scaleAndAdd(topColor, topColor, cornerColors[0], cornerDist[0]); // may exceed 1 for factors, but will be clamped by gpu
						vec3.scaleAndAdd(topColor, topColor, cornerColors[1], cornerDist[1]);
						vec3.scaleAndAdd(topColor, topColor, cornerColors[2], cornerDist[2]);
						vec3.scaleAndAdd(topColor, topColor, cornerColors[3], cornerDist[3]);

						vec3.scale(botColor, topColor, botDarkenFactor);
						vec3.scale(topColor, topColor, topDarkenFactor);
					}
				
					// ccw
					// wall top
					vtx(xb, h, za);
					vtx(xb, 0, za);
					vtx(xa, 0, za);

					vtx(xa, 0, za);
					vtx(xa, h, za);
					vtx(xb, h, za);
				
					nrm6(north);
					col6(topColor, botColor);

					// wall left
					vtx(xa, h, za);
					vtx(xa, 0, za);
					vtx(xa, 0, zb);

					vtx(xa, 0, zb);
					vtx(xa, h, zb);
					vtx(xa, h, za);

					nrm6(west);
					col6(topColor, botColor);
				
					// wall bottom
					vtx(xa, h, zb);
					vtx(xa, 0, zb);
					vtx(xb, 0, zb);

					vtx(xb, 0, zb);
					vtx(xb, h, zb);
					vtx(xa, h, zb);

					nrm6(south);
					col6(topColor, botColor);

					// wall right
					vtx(xb, h, zb);
					vtx(xb, 0, zb);
					vtx(xb, 0, za);
				
					vtx(xb, 0, za);
					vtx(xb, h, za);
					vtx(xb, h, zb);

					nrm6(east);
					col6(topColor, botColor);
				}
			}

			offset += 4;
			gridOffset++;
		}
	}

	var rdesc = render.makeMeshDescriptor(mapMesh);
	rdesc.primitiveType = mesh.PrimitiveType.Triangle;

	console.info("map inuse", inuse);
	console.info("vtx", vertexes.count, "cams", cameras.length);

	return {
		cameras: cameras,
		grid: grid,
		path: path,
		gridW: pixw,
		gridH: pixh,
		mesh: new render.Mesh(rctx, rdesc),
		cornerColors: cornerColors
	};
}


function genMapMesh(rctx: render.RenderContext, then: (mapData: MapData) => void) {	
	loadImageData("data/levelx_.png").then((pix) => {
		then(buildMapFromImageData(rctx, pix));
	});
}
