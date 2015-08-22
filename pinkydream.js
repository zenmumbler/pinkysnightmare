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


function Camera(canvas) {
	var w = canvas.width;
	var h = canvas.height;
	gl.viewport(0, 0, w, h);

	this.projectionMatrix = mat4.create();
	mat4.perspective(this.projectionMatrix, 65, w / h, 0.05, 100.0);
	
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


var mapModel;
var shaderProgram;


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



function initShaders() {
	var fragmentShader = getShader("shader-fs");
	var vertexShader = getShader("shader-vs");

	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		alert("Could not initialise shaders");
	}

	gl.useProgram(shaderProgram);

	shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "vertexPos_model");
	gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

	shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "vertexColor");
	gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);

// 	shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "vertexNormal");
// 	gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

	shaderProgram.projMatrixUniform = gl.getUniformLocation(shaderProgram, "projectionMatrix");
	shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "modelViewMatrix");
}



function drawScene(camera) {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	camera.updateViewMatrix();
	gl.uniformMatrix4fv(shaderProgram.projMatrixUniform, false, camera.projectionMatrix);

	mapModel.draw(camera, shaderProgram);
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
		initShaders();

		function nextFrame() {
			drawScene(camera);
	// 		requestAnimationFrame(nextFrame);
		}
		
		genMapMesh(function(mapMesh) {
			mapModel = new SimpleModel(mapMesh);
			camera.translate([27, 3, 25]);
			nextFrame();
		});
	});

}



// -----------------------------


on(window, "load", main);