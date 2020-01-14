function seq<T>(t: T) { return (Array.isArray(t)) ? t : [t]; }
function $n(sel: string, base?: HTMLElement): HTMLElement[] { return Array.prototype.slice.call((base || document).querySelectorAll(sel), 0); }
function $(sel: string | HTMLElement, base?: HTMLElement): HTMLElement[] { return (typeof (sel) == 'string') ? $n(sel, base) : seq(sel); }
export function $1(sel: string | HTMLElement, base?: HTMLElement) { return $(sel, base)[0]; }

export function on(target: string | HTMLElement | Window, evt: string, handler: EventHandlerNonNull) { (target === window ? [target] : $(target as string)).forEach(function (tgt: EventTarget) { tgt.addEventListener(evt, handler, false); }); }
export function show(sel: string | HTMLElement, disp?: string) { $(sel).forEach(function (el) { el.style.display = disp || "block" }); }
export function hide(sel: string | HTMLElement) { $(sel).forEach(function (el) { el.style.display = "none" }); }

export function assert(cond: any, msg?: string): asserts cond {
	if (!cond) {
		throw new Error(msg || "assertion failed");
	}
}
