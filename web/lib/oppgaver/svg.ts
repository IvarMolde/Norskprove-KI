import {
  DOMParser,
  XMLSerializer,
  type Element as XmlElement,
  type Node as XmlNode,
} from "@xmldom/xmldom";

const TEGNING = new Set([
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
]);

const ELEMENT = new Set([
  "svg",
  "g",
  "defs",
  "title",
  "desc",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "symbol",
  "use",
  ...TEGNING,
]);

const ATTRIBUTT = new Set([
  "viewBox",
  "width",
  "height",
  "xmlns",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "fill-rule",
  "clip-rule",
  "d",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "fx",
  "fy",
  "points",
  "transform",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "id",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "clip-path",
  "mask",
  "font-size",
  "font-family",
  "text-anchor",
  "preserveAspectRatio",
  "href",
  "xlink:href",
]);

const INTERN_LENKE = /^#[A-Za-z_][\w.-]*$/;

function tagNavn(element: XmlElement): string {
  return element.localName || element.nodeName;
}

function harTegning(element: XmlElement): boolean {
  if (TEGNING.has(tagNavn(element))) {
    return true;
  }
  for (let i = 0; i < element.childNodes.length; i += 1) {
    const barn = element.childNodes[i];
    if (barn.nodeType === 1 && harTegning(barn as XmlElement)) {
      return true;
    }
  }
  return false;
}

function rensElement(element: XmlElement): void {
  const navn = tagNavn(element);
  const prefix = element.prefix;
  if ((prefix && prefix !== "svg") || !ELEMENT.has(navn)) {
    element.parentNode?.removeChild(element);
    return;
  }

  const attributter: string[] = [];
  for (let i = 0; i < element.attributes.length; i += 1) {
    attributter.push(element.attributes[i].name);
  }
  for (const attributt of attributter) {
    const verdi = element.getAttribute(attributt) ?? "";
    const lenke = attributt === "href" || attributt === "xlink:href";
    const farlig = /javascript\s*:|expression\s*\(|url\s*\(/i.test(verdi);
    if (!ATTRIBUTT.has(attributt) || farlig || (lenke && !INTERN_LENKE.test(verdi.trim()))) {
      element.removeAttribute(attributt);
    }
  }

  if (navn === "svg") {
    element.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const barn: XmlNode[] = [];
  for (let i = 0; i < element.childNodes.length; i += 1) {
    barn.push(element.childNodes[i]);
  }
  for (const node of barn) {
    if (node.nodeType === 1) {
      rensElement(node as XmlElement);
    } else if (node.nodeType !== 3) {
      element.removeChild(node);
    }
  }
}

export function rensSvg(bytes: Uint8Array): Uint8Array | null {
  if (bytes.includes(0)) {
    return null;
  }

  let tekst: string;
  try {
    tekst = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return null;
  }

  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA/i.test(tekst) || !/<\s*svg[\s>]/i.test(tekst)) {
    return null;
  }

  try {
    const dokument = new DOMParser({
      onError(level) {
        if (level !== "warning") {
          throw new Error("svg");
        }
      },
    }).parseFromString(tekst, "image/svg+xml");
    const rot = dokument.documentElement;
    if (!rot || tagNavn(rot) !== "svg") {
      return null;
    }
    rensElement(rot);
    if (tagNavn(rot) !== "svg" || !harTegning(rot)) {
      return null;
    }
    const xml = new XMLSerializer().serializeToString(rot);
    if (!xml.startsWith("<svg") || /<script|javascript\s*:|foreignObject/i.test(xml)) {
      return null;
    }
    return new TextEncoder().encode(xml);
  } catch {
    return null;
  }
}
