import L from 'leaflet'
import { feature, mesh } from 'topojson-client'

// 세계 지도를 웹 메르카토르로 미리 투영한 SVG 한 장으로 만들어 지도에 고정한다.
// 줌하는 동안에도 벡터 그대로 커지고 작아지므로 픽셀이 깨지거나 가장자리가 비었다가 튀지 않는다.
const LAT = 85.0511287798 // 메르카토르 한계 위도 (세계가 정사각형이 되는 범위)
const LON_MIN = -180
const LON_MAX = 190 // 날짜변경선을 넘겨 이어 붙인 러시아·피지 동쪽 끝까지
const W = 1000 // 경도 360° = SVG 1000 단위
const BOUNDS = [[-LAT, LON_MIN], [LAT, LON_MAX]]

const px = (lon) => ((lon - LON_MIN) / 360) * W
const py = (lat) => {
  const s = Math.sin((Math.max(-LAT, Math.min(LAT, lat)) * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * W
}
const path = (lines, close) =>
  lines
    .map((line) => 'M' + line.map(([lon, lat]) => `${px(lon).toFixed(2)},${py(lat).toFixed(2)}`).join('L') + (close ? 'Z' : ''))
    .join('')

// 날짜변경선(180°)을 넘는 선(러시아, 피지)이 화면을 가로지르는 띠로 그려지지 않도록 경도를 이어 붙인다
const unwrapLine = (line) => {
  let offset = 0
  return line.map(([x, y], i) => {
    if (i) {
      const d = x - line[i - 1][0]
      if (d > 180) offset -= 360
      else if (d < -180) offset += 360
    }
    return [x + offset, y]
  })
}

const rings = (g) => (g.type === 'MultiPolygon' ? g.coordinates.flat() : g.coordinates).map(unwrapLine)

const isAntarctica = (f) => f.properties.name === 'Antarctica'

// 15° 간격 경위선
const graticule = () => {
  const lines = []
  for (let lon = -180; lon <= 180; lon += 15) lines.push([[lon, -80], [lon, 85]])
  for (let lat = -75; lat <= 75; lat += 15) lines.push([[LON_MIN, lat], [LON_MAX, lat]])
  return lines
}

// 선 굵기는 줌과 상관없이 화면 픽셀 기준으로 유지한다
const line = (d, opacity, width) =>
  `<path d="${d}" fill="none" stroke="#8d8d8d" stroke-opacity="${opacity}" stroke-width="${width}" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`

// Natural Earth 110m(퍼블릭 도메인)를 별도 청크로 불러와 경위선 → 육지 면 → 국경선 → 해안선 순으로 그린다
export async function addWorldLayers(map) {
  const { default: topo } = await import('world-atlas/countries-110m.json')
  const countries = topo.objects.countries

  const land = feature(topo, countries)
    .features.filter((f) => !isAntarctica(f))
    // 나라마다 따로 그려야 구멍(예: 남아공 안의 레소토)이 evenodd 로 뚫리고 그 안의 나라는 채워진다
    .map((f) => `<path d="${path(rings(f.geometry), true)}"/>`)
    .join('')
  const borders = mesh(topo, countries, (a, b) => a !== b && !isAntarctica(a) && !isAntarctica(b))
  const coast = mesh(topo, countries, (a, b) => a === b && !isAntarctica(a))

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${px(LON_MAX)} ${W}`)
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.innerHTML = [
    line(path(graticule()), 0.12, 0.5),
    `<g fill="#333333" fill-opacity="0.75" fill-rule="evenodd">${land}</g>`,
    line(path(borders.coordinates.map(unwrapLine)), 0.22, 0.4),
    line(path(coast.coordinates.map(unwrapLine)), 0.55, 0.7),
  ].join('')

  return L.svgOverlay(svg, BOUNDS, { interactive: false }).addTo(map)
}
