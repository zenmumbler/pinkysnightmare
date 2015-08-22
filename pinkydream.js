(function(){
// Pinky's Nightmare
// An entry for LD33 Game Jampo — You are the Monster
// (c) 2015 by Arthur Langereis — @zenmumbler

function seq(t) { return (Array.isArray(t)) ? t : [t]; }
function $n(sel,base) { return Array.prototype.slice.call((base||document).querySelectorAll(sel), 0); }
function $(sel,base) { return (typeof(sel) == 'string') ? $n(sel,base) : seq(sel); }
function $1(sel,base) { return $(sel,base)[0]; }

function on(target, evt, handler) { $(target).forEach(function(tgt) { tgt.addEventListener(evt, handler, false); }); }
function show(sel,disp) { $(sel).forEach(function(el){ el.style.display = disp||"block" }); }
function hide(sel) { $(sel).forEach(function(el){ el.style.display = "none" }); }

function assert(cond, msg) {
	if (! cond) {
		throw new Error(msg || "assertion failed");
	}
}


// -----------------------------


var gl;


function TriMesh(vertexArray, normalArray, colorArray) {
	assert(vertexArray && vertexArray.length && (vertexArray.length % 9 == 0), "vertex array must be a triangle soup"); // 3 vtx * 3 floats
	assert(normalArray && (normalArray.length == vertexArray.length), "normal array must be same size as vertex array");
	assert(colorArray && (colorArray.length == vertexArray.length), "color array must be same size as vertex array");

	this.vertexBuffer = gl.createBuffer();
	this.normalBuffer = gl.createBuffer();
	this.colorBuffer = gl.createBuffer();
	
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexArray), gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorArray), gl.STATIC_DRAW);

	this.elements = vertexArray.length / 3;
	
	this.draw = function(program) {
		assert(program);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.vertexAttribPointer(program.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
		gl.vertexAttribPointer(program.vertexColorAttribute, 3, gl.FLOAT, false, 0, 0);

// 		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
// 		gl.vertexAttribPointer(program.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

		gl.drawArrays(gl.TRIANGLES, 0, this.elements);
	};
}
window.TriMesh = TriMesh;


function SimpleModel(mesh) {
	this.mesh = mesh;
	this.modelMatrix = mat4.create();
	var modelViewMatrix = mat4.create();
	
	this.draw = function(camera, program) {
		mat4.multiply(modelViewMatrix, camera.viewMatrix, this.modelMatrix);
		gl.uniformMatrix4fv(program.mvMatrixUniform, false, modelViewMatrix);

		this.mesh.draw(program);
	};
	
	this.translate = function(v3) {
		mat4.translate(this.modelMatrix, this.modelMatrix, v3);
	};
}
window.SimpleModel = SimpleModel;


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

	this.translate = function(v3) {
		mat4.translate(this.cameraMatrix, this.cameraMatrix, v3);
	};

	this.updateViewMatrix = function() {
		mat4.invert(this.viewMatrix, this.cameraMatrix);
	};
}


/*
	Meshes:
		Map
		Pac Open
		Pac Closed
		Pinky
		Key
		Door
	
	Models:
		Map
		Pac x 2-4
		Pinky
		Key x 4
		Door x 1
*/


var state = {
	keys: [],
	models: {},
	modelProgram: null
};
var active = true;

var KEY_UP = 38, KEY_DOWN = 40, KEY_LEFT = 37, KEY_RIGHT = 39,
	KEY_SPACE = 32, KEY_RETURN = 13;



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
	gl.enableVertexAttribArray(program.vertexPositionAttribute);

	program.vertexColorAttribute = gl.getAttribLocation(program, "vertexColor");
	gl.enableVertexAttribArray(program.vertexColorAttribute);

// 	program.vertexNormalAttribute = gl.getAttribLocation(program, "vertexNormal");
// 	gl.enableVertexAttribArray(program.vertexNormalAttribute);

	program.projMatrixUniform = gl.getUniformLocation(program, "projectionMatrix");
	program.mvMatrixUniform = gl.getUniformLocation(program, "modelViewMatrix");
	
	return program;
}



function drawScene(camera) {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	camera.updateViewMatrix();
	gl.uniformMatrix4fv(state.modelProgram.projMatrixUniform, false, camera.projectionMatrix);

	state.mapModel.draw(camera, state.modelProgram);
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


function main() {
	setupGL(function(camera) {
		state.modelProgram = createStandardProgram("standardVert", "standardFrag");

		function nextFrame() {
			if (state.keys[KEY_UP]) {
				camera.translate([0, 0, -1.0/9]);
			}
			if (state.keys[KEY_DOWN]) {
				camera.translate([0, 0, 1.0/9]);
			}
			if (state.keys[KEY_LEFT]) {
				camera.translate([-1.0/9, 0, 0]);
			}
			if (state.keys[KEY_RIGHT]) {
				camera.translate([1.0/9, 0, 0]);
			}

			drawScene(camera);

			if (active)
		 		requestAnimationFrame(nextFrame);
		}

		window.onkeydown = function(evt) {
			var kc = evt.keyCode;
			state.keys[kc] = true;
// 			evt.preventDefault();
		};
		window.onkeyup = function(evt) {
			var kc = evt.keyCode;
			state.keys[kc] = false;
// 			evt.preventDefault();
		};
		window.onblur = function() { active = false };
		window.onfocus = function() { state.t0 = Date.now(); active = true; nextFrame(); };
		
		genMapMesh(function(mapMesh) {
			state.mapModel = new SimpleModel(mapMesh);
			camera.translate([54, 2, 50]);
			nextFrame();
		});
	});

}



// -----------------------------


on(window, "load", main);
}());
