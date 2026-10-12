import L from 'leaflet'
import { feature, mesh } from 'topojson-client'

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

const unwrap = (g) => {
  if (g.type === 'MultiPolygon') return { ...g, coordinates: g.coordinates.map((p) => p.map(unwrapLine)) }
  return { ...g, coordinates: g.coordinates.map(unwrapLine) } // Polygon, MultiLineString
}

const isAntarctica = (f) => f.properties.name === 'Antarctica'

// 15° 간격 경위선
const graticule = () => {
  const lines = []
  for (let lon = -180; lon <= 180; lon += 15) lines.push([[lon, -80], [lon, 85]])
  for (let lat = -75; lat <= 75; lat += 15) lines.push([[-180, lat], [180, lat]])
  return { type: 'MultiLineString', coordinates: lines }
}

const line = (color, weight, opacity) => ({ interactive: false, style: { color, weight, opacity, fill: false } })

// Natural Earth 110m(퍼블릭 도메인)를 별도 청크로 불러와 육지 면 → 국경선 → 해안선 순으로 그린다
export async function addWorldLayers(map) {
  const { default: topo } = await import('world-atlas/countries-110m.json')
  const countries = topo.objects.countries

  const land = feature(topo, countries).features.filter((f) => !isAntarctica(f))
  const borders = mesh(topo, countries, (a, b) => a !== b && !isAntarctica(a) && !isAntarctica(b))
  const coast = mesh(topo, countries, (a, b) => a === b && !isAntarctica(a))

  return L.layerGroup([
    L.geoJSON(graticule(), line('#8d8d8d', 0.5, 0.12)),
    L.geoJSON(
      land.map((f) => ({ ...f, geometry: unwrap(f.geometry) })),
      { interactive: false, style: { stroke: false, fillColor: '#333333', fillOpacity: 0.75 } },
    ),
    L.geoJSON(unwrap(borders), line('#8d8d8d', 0.4, 0.22)),
    L.geoJSON(unwrap(coast), line('#8d8d8d', 0.7, 0.55)),
  ]).addTo(map)
}
