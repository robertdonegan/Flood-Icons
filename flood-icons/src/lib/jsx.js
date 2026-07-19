/**
 * SVG → JSX conversion for copy-to-clipboard.
 * Handles the attribute renames React needs; our icons use a known,
 * small attribute vocabulary so a lookup table is safer than regex guessing.
 */
const ATTR_MAP = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'clip-path': 'clipPath',
  'xmlns:xlink': 'xmlnsXlink',
  'xlink:href': 'xlinkHref',
  class: 'className',
};

export function svgToJsx(svg) {
  let jsx = svg;
  for (const [from, to] of Object.entries(ATTR_MAP)) {
    jsx = jsx.replaceAll(`${from}=`, `${to}=`);
  }
  // fill="var(--fi-water, #0a7dff)" is valid JSX as-is; nothing else to do.
  return jsx;
}

const pascal = (id) =>
  id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');

/**
 * Full, paste-ready React component. Mono icons expose size/strokeWidth props
 * and inherit colour from CSS `currentColor`; colour icons expose size and
 * carry their token fills (with hex fallbacks) with them.
 */
export function svgToComponent(icon) {
  const name = pascal(icon.id) + 'Icon';
  let jsx = svgToJsx(icon.svg)
    .replace(/<svg /, '<svg width={size} height={size} ')
    .replace(/\/>/g, ' />')
    .replace(/></g, '>\n      <')
    .replace(/<\/svg>/, '\n    </svg>');

  if (icon.strokeAdjustable) {
    jsx = jsx.replace(/strokeWidth="[\d.]+"/, 'strokeWidth={strokeWidth}');
    return `export function ${name}({ size = 24, strokeWidth = 1.5, title = '${icon.name}', ...props }) {
  return (
    ${jsx.replace('<svg ', '<svg role="img" aria-label={title} {...props} ')}
  );
}
`;
  }
  return `export function ${name}({ size = 24, title = '${icon.name}', ...props }) {
  return (
    ${jsx.replace('<svg ', '<svg role="img" aria-label={title} {...props} ')}
  );
}
`;
}
