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


// -----------------------------



function main() {
	
}



// -----------------------------


on(window, "DOMContentLoaded", main);