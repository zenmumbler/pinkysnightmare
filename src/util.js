export function seq(t) { return (Array.isArray(t)) ? t : [t]; }
export function $n(sel, base) { return Array.prototype.slice.call((base || document).querySelectorAll(sel), 0); }
export function $(sel, base) { return (typeof (sel) == 'string') ? $n(sel, base) : seq(sel); }
export function $1(sel, base) { return $(sel, base)[0]; }

export function on(target, evt, handler) { $(target).forEach(function (tgt) { tgt.addEventListener(evt, handler, false); }); }
export function show(sel, disp) { $(sel).forEach(function (el) { el.style.display = disp || "block" }); }
export function hide(sel) { $(sel).forEach(function (el) { el.style.display = "none" }); }

export function assert(cond, msg) {
	if (!cond) {
		throw new Error(msg || "assertion failed");
	}
}
