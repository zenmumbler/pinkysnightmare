// Pinky's Nightmare
// An entry for LD33 Game Jampo — You are the Monster
// (c) 2015 by Arthur Langereis — @zenmumbler

var gl;

var state = {
	keys: [],
	meshes: {},
	models: {}
};

var active = true;

var KEY_UP = 38, KEY_DOWN = 40, KEY_LEFT = 37, KEY_RIGHT = 39,
	KEY_SPACE = 32, KEY_RETURN = 13,
	KEY_W = 'W'.charCodeAt(0), KEY_A = 'A'.charCodeAt(0), KEY_S = 'S'.charCodeAt(0), KEY_D = 'D'.charCodeAt(0);


vec2.equals = function(a, b) {
	return a[0] == b[0] && a[1] == b[1];
};


function TriMesh(vertexArray, normalArray, colorArray, uvArray) {
	assert(vertexArray && vertexArray.length && (vertexArray.length % 9 == 0), "vertex array must be a triangle soup"); // 3 vtx * 3 floats
	assert(normalArray && (normalArray.length == vertexArray.length), "normal array must be same size as vertex array");
	assert(colorArray && (colorArray.length == vertexArray.length), "color array must be same size as vertex array");
	if (uvArray)
		assert((uvArray.length / 2) == (vertexArray.length / 3), "each vertex needs a uv");

	this.vertexBuffer = gl.createBuffer();
	this.normalBuffer = gl.createBuffer();
	this.colorBuffer = gl.createBuffer();
	this.uvBuffer = uvArray ? gl.createBuffer() : null;

	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexArray), gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorArray), gl.STATIC_DRAW);

	if (this.uvBuffer) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvArray), gl.STATIC_DRAW);
	}

	this.elements = vertexArray.length / 3;

	this.draw = function(program, texture) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.enableVertexAttribArray(program.vertexPositionAttribute);
		gl.vertexAttribPointer(program.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
		gl.enableVertexAttribArray(program.vertexColorAttribute);
		gl.vertexAttribPointer(program.vertexColorAttribute, 3, gl.FLOAT, false, 0, 0);

		if (program.vertexNormalAttribute > -1) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
			gl.enableVertexAttribArray(program.vertexNormalAttribute);
			gl.vertexAttribPointer(program.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);
		}

		if (program.vertexUVAttribute > -1) {
			if (this.uvBuffer) {
				gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
				gl.enableVertexAttribArray(program.vertexUVAttribute);
				gl.vertexAttribPointer(program.vertexUVAttribute, 2, gl.FLOAT, false, 0, 0);
			}
			else {
				gl.disableVertexAttribArray(program.vertexUVAttribute);
			}
		}

		if (texture && program.textureUniform) {
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.uniform1i(program.textureUniform, 0);
		}

		gl.drawArrays(gl.TRIANGLES, 0, this.elements);

		if (texture && program.textureUniform) {
			gl.bindTexture(gl.TEXTURE_2D, null);
		}
	};
}


function genColorArray(color, times) {
	var result = [];
	for (var n=0; n < times; ++n) {
		result.push(color[0], color[1], color[2]);
	}
	return result;
}


function u8Color(r,g,b) {
	return [r/255, g/255, b/255];
}


function Model(/* mesh0, mesh1, ... */) {
	this.meshes = [].slice.call(Model.arguments, 0);
	this.texture = null;

	var scaleMat = mat4.create();
	var rotMat = mat4.create();
	var transMat = mat4.create();
	var modelMatrix = mat4.create();
	var modelViewMatrix = mat4.create();
	var normalMatrix = mat3.create();

	this.draw = function(camera, program, meshIndex) {
		mat4.multiply(modelMatrix, transMat, rotMat);
		mat4.multiply(modelMatrix, modelMatrix, scaleMat);

		this.debugModelMatrix = mat4.clone(modelMatrix);

		mat4.multiply(modelViewMatrix, camera.viewMatrix, modelMatrix);
		gl.uniformMatrix4fv(program.mvMatrixUniform, false, modelViewMatrix);

		if (program.normalMatrixUniform) {
			mat3.fromMat4(normalMatrix, modelViewMatrix);
			mat3.invert(normalMatrix, normalMatrix);
			mat3.transpose(normalMatrix, normalMatrix);
			gl.uniformMatrix3fv(program.normalMatrixUniform, false, normalMatrix);
		}

		this.meshes[meshIndex].draw(program, this.texture);
	};

	this.setUniformScale = function(s) {
		mat4.fromScaling(scaleMat, [s, s, s]);
	};

	this.setPosition = function(v3) {
		mat4.fromTranslation(transMat, v3);
	};

	this.setRotation = function(axis, angle) {
		mat4.fromRotation(rotMat, angle, axis);
	};
}


function deg2rad(deg) {
	return deg * 3.14159265358979323846 / 180.0;
}


function Camera(canvas) {
	var w = canvas.width;
	var h = canvas.height;
	gl.viewport(0, 0, w, h);

	this.projectionMatrix = mat4.create();
	mat4.perspective(this.projectionMatrix, deg2rad(65), w / h, 0.05, 100.0);
	this.cameraMatrix = mat4.create();
	this.viewMatrix = mat4.create();

	this.updateViewMatrix = function() {
// 		mat4.copy(this.viewMatrix, this.cameraMatrix);
// 		mat4.invert(this.viewMatrix, this.cameraMatrix);
	};
	
	this.pickClosestVantagePoint = function() {
		var playerPos = vec2.fromValues(state.player.position[0], state.player.position[2]);
		
		this.fixedPoints.sort(function(fpa, fpb) {
			var distA = vec2.squaredDistance(fpa, playerPos);
			var distB = vec2.squaredDistance(fpb, playerPos);
			return (distA < distB) ? -1 : ((distB < distA) ? 1 : 0);
		});
		
		var bestCam = this.fixedPoints[0];
		var camPos = vec3.fromValues(bestCam[0], 5, bestCam[1]);
		vec3.scale(camPos, camPos, LEVEL_SCALE);

		var playerPos = vec3.clone(state.player.position);
		vec3.scale(playerPos, playerPos, LEVEL_SCALE);

 		mat4.lookAt(this.viewMatrix, camPos, playerPos, [0,1,0]);
	};
}


function Square(x, y) {
	var min = vec2.fromValues(x,y),
		max = vec2.fromValues(x+1, y+1);
	this.center = vec2.fromValues(x+.5, y+.5);

	this.closestPoint = function(pt2) {
		var closest = vec2.create();
		vec2.max(closest, min, pt2);
		vec2.min(closest, max, closest);
		return closest;
	};
	
	var normals = [
		vec2.fromValues(-1, 0), // left
		vec2.fromValues(1, 0), // right
		vec2.fromValues(0, -1), // top
		vec2.fromValues(0, 1), // bottom
		vec2.fromValues(Math.sqrt(2), Math.sqrt(2)) // inner (hack)
	];
	
	this.containsPoint = function(pt2) {
		return vec2.equals(this.closestPoint(pt2), pt2);
	};
	
	this.normalAtClosestPoint = function(pt2) {
		var closest = this.closestPoint(pt2);
		
		if (vec2.equals(closest, pt2)) { // pt2 contained in box
			return vec2.clone(normals[4]); // HACK: push out diagonally down right
		}
		
		if (closest[0] == min[0]) {
			return vec2.clone(normals[0]);
		}
		else if (closest[0] == max[0]) {
			return vec2.clone(normals[1]);
		}
		else if (closest[1] == min[1]) {
			return vec2.clone(normals[2]);
		}

		return vec2.clone(normals[3]);
	};

	this.distanceToPoint = function(pt2) {
		return vec2.distance(this.closestPoint(pt2), pt2);
	};
}


function Grid(width, height, cells) {
	var squares = [], sqix = 0;
	for (var z=0; z<height; ++z) {
		for (var x=0; x<width; ++x) {
			if (cells[sqix])
				squares[sqix] = new Square(x, z);
			else
				squares[sqix] = null;

			++sqix;
		}
	}

	function at(x, z) {
		return squares[(z>>0) * width + (x>>0)];
	}

	this.collideAndResolveCircle = function(posFrom, posTo, radius) /* -> vec2 */ {
		var direction = vec2.create();
		vec2.subtract(direction, posTo, posFrom);

		var toCheck = [];
		var minX = (posTo[0] - radius)<<0, maxX = (posTo[0] + radius)<<0;
		var minZ = (posTo[1] - radius)<<0, maxZ = (posTo[1] + radius)<<0;

		for (var tz = minZ; tz <= maxZ; ++tz) {
			for (var tx = minX; tx <= maxX; ++tx) {
				var sq = at(tx, tz);
				if (sq) toCheck.push(sq);
			}
		}

		if (! toCheck.length)
			return posTo;

		var closestSquare = null, closestDist = 99999;
		toCheck.forEach(function(sq) {
			var dist = sq.distanceToPoint(posTo);
			if (dist < closestDist) {
				closestDist = dist;
				closestSquare = sq;
			}
		});

		if (closestSquare && closestDist < radius) {
			// not perfect but will work for now
			var planeNormal = closestSquare.normalAtClosestPoint(posTo);
			vec2.scale(planeNormal, planeNormal, radius - closestDist);
			vec2.add(posTo, posTo, planeNormal);
		}

		return posTo;
	};
}


function Player(model) {
	this.model = model;
	this.position = vec3.fromValues(0, 0.3, 0); // grid units
	this.viewAngle = Math.PI / 2; // radians
	this.turnSpeed = Math.PI; // radians / sec
	this.speed = 1.75; // grid units / sec
	this.radius = .25; // grid units

	this.model.setUniformScale(1);

	var scaledPos = vec3.create();
	var rotAxis = vec3.fromValues(0, 1, 0);

	this.moveTo2D = function(x, z) {
		vec3.set(this.position, x, this.position[1], z);
	};

	var moveMat = mat2.create();
	var movePos = vec2.create();

	this.update = function(dt) {
		// -- rotation
		var turnAngle = 0;
		if (state.keys[KEY_LEFT]) {
			turnAngle = -this.turnSpeed;
		}
		else if (state.keys[KEY_RIGHT]) {
			turnAngle = this.turnSpeed;
		}
		this.viewAngle += turnAngle * dt;

		// -- movement
		var speed = 0;
		if (state.keys[KEY_UP]) {
			speed = -this.speed;
		}
		else if (state.keys[KEY_DOWN]) {
			speed = this.speed;
		}

		if (speed != 0) {
			mat2.fromRotation(moveMat, this.viewAngle);
			mat2.scale(moveMat, moveMat, [speed * dt, speed * dt]);
			vec2.set(movePos, 1, 0);
			vec2.transformMat2(movePos, movePos, moveMat);

			var oldPos = vec2.fromValues(this.position[0], this.position[2]);
			var newPos = vec2.create();
			vec2.add(newPos, oldPos, movePos);

			newPos = state.grid.collideAndResolveCircle(oldPos, newPos, this.radius);

			this.position[0] = newPos[0];
			this.position[2] = newPos[1];
		}

	};

	this.draw = function() {
		vec3.scale(scaledPos, this.position, LEVEL_SCALE);
		this.model.setPosition(scaledPos);
		this.model.setRotation(rotAxis, -this.viewAngle);
		model.draw(state.camera, state.modelProgram, 0);
	};
}


function drawScene(camera) {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	camera.updateViewMatrix();

	gl.useProgram(state.modelProgram);
	gl.uniformMatrix4fv(state.modelProgram.projMatrixUniform, false, camera.projectionMatrix);
	if (state.modelProgram.timeUniform)
		gl.uniform1f(state.modelProgram.timeUniform, state.tCur - state.t0);

	state.models["map"].draw(camera, state.modelProgram, 0);
	state.player.draw();

	gl.useProgram(state.texturedProgram);
	gl.uniformMatrix4fv(state.texturedProgram.projMatrixUniform, false, camera.projectionMatrix);
	if (state.texturedProgram.timeUniform)
		gl.uniform1f(state.texturedProgram.timeUniform, state.tCur - state.t0);

	state.models["pac"].draw(camera, state.texturedProgram, 1);

}


function getShader(id) {
	var shaderScript = document.getElementById(id);
	assert(shaderScript, "no such shader: " + id);

	var shader;
	if (shaderScript.type == "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if (shaderScript.type == "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		assert(false, id + " does not seem to be a shader");
	}

	gl.shaderSource(shader, shaderScript.textContent);
	gl.compileShader(shader);

	if (! gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		assert(false, "bad shader");
	}

	return shader;
}


function createStandardTexture(fileName, then) {
	var texture = gl.createTexture();
	var image = new Image();
	image.onload = function() {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.bindTexture(gl.TEXTURE_2D, null);

		then(texture);
	};

	image.src = fileName;
}


function createStandardProgram(vertID, fragID) {
	var program = gl.createProgram();
	gl.attachShader(program, getShader(vertID));
	gl.attachShader(program, getShader(fragID));
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		alert("Could not initialise shaders");
	}

	gl.useProgram(program);

	program.vertexPositionAttribute = gl.getAttribLocation(program, "vertexPos_model");
	program.vertexColorAttribute = gl.getAttribLocation(program, "vertexColor");
	program.vertexNormalAttribute = gl.getAttribLocation(program, "vertexNormal");
	program.vertexUVAttribute = gl.getAttribLocation(program, "vertexUV");

	program.projMatrixUniform = gl.getUniformLocation(program, "projectionMatrix");
	program.mvMatrixUniform = gl.getUniformLocation(program, "modelViewMatrix");
	program.normalMatrixUniform = gl.getUniformLocation(program, "normalMatrix");
	program.textureUniform = gl.getUniformLocation(program, "diffuseSampler");
	program.timeUniform = gl.getUniformLocation(program, "currentTime");

	gl.useProgram(null);

	return program;
}


function setupGL(then) {
	var canvas = document.getElementById("stage");
	var camera;
	try {
		gl = canvas.getContext("webgl");
		if (! gl)
			gl = canvas.getContext("experimental-webgl");
	} catch (e) {
		gl = null;
	}

	if (! gl) {
		alert("Could not initialise WebGL");
	}
	else {
		gl.clearColor(0.1, 0.0, 0.05, 1.0);
		gl.enable(gl.DEPTH_TEST);
		then(new Camera(canvas));
	}
}


function nextFrame() {
	state.tCur = Date.now();
	var dt = 1/60;

	var camera = state.camera;

	camera.pickClosestVantagePoint();
	state.player.update(dt);
	drawScene(camera);

	if (active)
		requestAnimationFrame(nextFrame);
}


function run() {
	state.t0 = Date.now();
	nextFrame();
}


function init() {
	setupGL(function(camera) {
		state.camera = camera;
		state.modelProgram = createStandardProgram("standardVert", "standardFrag");
		state.texturedProgram = createStandardProgram("texturedVert", "texturedFrag");

		window.onkeydown = function(evt) {
			var kc = evt.keyCode;
			state.keys[kc] = true;
// 			if (! evt.modifiers)
// 				evt.preventDefault();
		};
		window.onkeyup = function(evt) {
			var kc = evt.keyCode;
			state.keys[kc] = false;
// 			if (! evt.modifiers)
// 				evt.preventDefault();
		};
		window.onblur = function() { active = false; };
		window.onfocus = function() { state.t0 = Date.now(); active = true; nextFrame(); };

		on("button", "click", function() {
			$1("canvas").webkitRequestFullscreen();
		});

		genMapMesh(function(mapData) {
			state.meshes["map"] = mapData.mesh;
			state.models["map"] = new Model(mapData.mesh);
			state.camera.fixedPoints = mapData.cameras;
			state.grid = new Grid(mapData.gridW, mapData.gridH, mapData.grid);

			var pacColor = u8Color(213, 215, 17);

			// Promises are for wimps
			createStandardTexture("crackpac.png", function(pacTex) {
				loadObjFile("pac1.obj", function(pac1Data) {
					var pac1Colors = genColorArray(pacColor, pac1Data.elements);
					state.meshes["pac1"] = new TriMesh(pac1Data.vertexes, pac1Data.normals, pac1Colors, pac1Data.uvs);

					loadObjFile("pac2.obj", function(pac2Data) {
						var pac2Colors = genColorArray(pacColor, pac2Data.elements);
						state.meshes["pac2"] = new TriMesh(pac2Data.vertexes, pac2Data.normals, pac2Colors, pac2Data.uvs);

						var pac = new Model(state.meshes["pac1"], state.meshes["pac2"]);
						pac.setUniformScale(5);
						pac.setPosition([54, 0.1, 36]);
						pac.texture = pacTex;
						state.models["pac"] = pac;

						loadObjFile("key.obj", function(keyData) {
							var keyColors = genColorArray(u8Color(201,163,85), keyData.elements);
							state.meshes["key"] = new TriMesh(keyData.vertexes, keyData.normals, keyColors, null);

							loadObjFile("spookje.obj", function(spookjeData) {
								var spookjeColors = genColorArray(u8Color(255,184,221), spookjeData.elements);
								state.meshes["spookje"] = new TriMesh(spookjeData.vertexes, spookjeData.normals, spookjeColors, null);

								state.models["pinky"] = new Model(state.meshes["spookje"]);
								state.player = new Player(state.models["pinky"]);
								state.player.moveTo2D(13.5, 11);

								run();
							});
						});
					});
				});
			});
		});
	});
}

on(window, "load", init);
