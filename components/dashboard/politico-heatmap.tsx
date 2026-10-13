"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Loader2, MapPin, Calendar, Megaphone, Info } from "lucide-react";

interface MunicipioMetric {
  count_agenda: number;
  count_comunicacao: number;
  ultima_visita: string | null;
}

interface ProjectedPath {
  id: string;
  nome: string;
  d: string;
}

interface PoliticoHeatmapProps {
  dataByMuni: Record<string, MunicipioMetric>;
  metricKey: "count_agenda" | "count_comunicacao";
  activeFilter: "none" | "sem_visita" | "baixa_comunicacao";
  highlightedMuniIds: Set<string>;
  onSelectMuni?: (muniId: string, nome: string) => void;
}

export default function PoliticoHeatmap({
  dataByMuni,
  metricKey,
  activeFilter,
  highlightedMuniIds,
  onSelectMuni,
}: PoliticoHeatmapProps) {
  const [geojson, setGeojson] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [hoveredMuni, setHoveredMuni] = useState<{ id: string; nome: string } | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside detection
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onSelectMuni?.("", "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onSelectMuni]);

  // 1. Fetch simplified GeoJSON from public folder
  useEffect(() => {
    const fetchGeoJSON = async () => {
      try {
        setCarregando(true);
        const res = await fetch("/ms-municipios.json");
        if (!res.ok) throw new Error("Falha ao carregar malha geográfica.");
        const data = await res.json();
        setGeojson(data);
      } catch (err: any) {
        console.error("Erro ao carregar mapa de MS:", err);
        setErro(err.message || "Não foi possível carregar o mapa.");
      } finally {
        setCarregando(false);
      }
    };
    void fetchGeoJSON();
  }, []);

  // 2. Compute bounding box for projection
  const bounds = useMemo(() => {
    if (!geojson) return null;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    geojson.features.forEach((feature: any) => {
      const processRing = (ring: number[][]) => {
        ring.forEach(([lon, lat]) => {
          if (lon < minX) minX = lon;
          if (lon > maxX) maxX = lon;
          if (lat < minY) minY = lat;
          if (lat > maxY) maxY = lat;
        });
      };

      if (feature.geometry.type === "Polygon") {
        feature.geometry.coordinates.forEach(processRing);
      } else if (feature.geometry.type === "MultiPolygon") {
        feature.geometry.coordinates.forEach((polygon: number[][][]) => {
          polygon.forEach(processRing);
        });
      }
    });

    return { minX, maxX, minY, maxY };
  }, [geojson]);

  // 3. Project geocoordinates to SVG paths
  const projectedPaths = useMemo<ProjectedPath[]>(() => {
    if (!geojson || !bounds) return [];
    const { minX, maxX, minY, maxY } = bounds;
    
    const width = 560;
    const height = 480;
    const padding = 15;

    const xRange = maxX - minX;
    const yRange = maxY - minY;
    
    // Scale preserving aspect ratio
    const scale = Math.min((width - padding * 2) / xRange, (height - padding * 2) / yRange);
    const xOffset = (width - xRange * scale) / 2;
    const yOffset = (height - yRange * scale) / 2;

    const project = (lon: number, lat: number) => {
      const x = (lon - minX) * scale + xOffset;
      const y = (maxY - lat) * scale + yOffset;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    return geojson.features.map((feature: any) => {
      let d = "";
      const formatRing = (ring: number[][]) => {
        return ring.map((pt, idx) => `${idx === 0 ? "M" : "L"}${project(pt[0], pt[1])}`).join(" ") + " Z";
      };

      if (feature.geometry.type === "Polygon") {
        d = feature.geometry.coordinates.map(formatRing).join(" ");
      } else if (feature.geometry.type === "MultiPolygon") {
        d = feature.geometry.coordinates.map((poly: number[][][]) => 
          poly.map(formatRing).join(" ")
        ).join(" ");
      }

      return {
        id: feature.properties.id,
        nome: feature.properties.nome,
        d,
      };
    });
  }, [geojson, bounds]);

  // 4. Color scale calculation
  const getMuniColor = (muniId: string) => {
    const metric = dataByMuni[muniId];
    const val = metric ? metric[metricKey] : 0;

    if (val === 0) return "#f8fafc"; // slate-50

    if (metricKey === "count_agenda") {
      // Blue/Indigo scale for visits
      if (val === 1) return "#bfdbfe"; // blue-200
      if (val <= 3) return "#60a5fa";  // blue-400
      if (val <= 5) return "#2563eb";  // blue-600
      return "#1d4ed8";                  // blue-750
    } else {
      // Emerald scale for communication posts
      if (val === 1) return "#a7f3d0"; // emerald-200
      if (val <= 3) return "#34d399";  // emerald-400
      if (val <= 5) return "#059669";  // emerald-600
      return "#047857";                  // emerald-750
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  if (carregando) {
    return (
      <div className="flex h-[450px] flex-col items-center justify-center gap-3 rounded-2xl bg-white border border-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-[#165cfb]" />
        <span className="text-xs text-slate-500 font-semibold">Carregando mapa geopolítico...</span>
      </div>
    );
  }

  if (erro || !geojson) {
    return (
      <div className="flex h-[450px] flex-col items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 p-6 text-center">
        <Info className="h-8 w-8 text-red-500" />
        <h4 className="text-sm font-bold text-slate-800">Falha ao renderizar mapa</h4>
        <p className="text-xs text-slate-455 max-w-xs">{erro || "Erro de carregamento do arquivo."}</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full max-w-[580px] bg-slate-50/20 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-center hover:shadow-xs transition-shadow animate-in fade-in duration-300"
      onMouseMove={handleMouseMove}
      onClick={() => onSelectMuni?.("", "")}
    >
      <svg
        viewBox="0 0 560 480"
        className="w-full h-auto select-none drop-shadow-xs cursor-default"
      >
        {projectedPaths.map((path) => {
          const isMuniHighlighted = activeFilter === "none" || highlightedMuniIds.has(path.id);
          const baseColor = getMuniColor(path.id);
          const hasActivity = (dataByMuni[path.id]?.count_agenda || 0) > 0 || (dataByMuni[path.id]?.count_comunicacao || 0) > 0;

          return (
            <path
              key={path.id}
              d={path.d}
              fill={baseColor}
              stroke={hasActivity ? "#334155" : "#cbd5e1"}
              strokeWidth={hasActivity ? "1.2" : "0.5"}
              className="transition-all duration-200 cursor-pointer outline-none hover:stroke-slate-800 hover:stroke-[1.8px]"
              style={{
                opacity: isMuniHighlighted ? 1 : 0.15,
                fill: baseColor,
              }}
              onMouseEnter={() => setHoveredMuni({ id: path.id, nome: path.nome })}
              onMouseLeave={() => setHoveredMuni(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectMuni?.(path.id, path.nome);
              }}
            />
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoveredMuni && (
        <div
          className="absolute pointer-events-none z-50 rounded-xl bg-slate-950/90 text-white p-3.5 shadow-xl border border-slate-800 text-[11px] font-bold backdrop-blur-xs flex flex-col gap-1.5 transition-all duration-75 animate-in fade-in zoom-in-95 duration-100"
          style={{ 
            left: hoveredPos.x + 15, 
            top: hoveredPos.y + 15,
            maxWidth: "200px"
          }}
        >
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5 mb-0.5">
            <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="font-extrabold text-xs text-white truncate">{hoveredMuni.nome}</span>
          </div>

          <div className="flex items-center justify-between gap-6 text-slate-350">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-blue-400" />
              Visitas:
            </span>
            <span className="text-white font-extrabold">
              {dataByMuni[hoveredMuni.id]?.count_agenda || 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-6 text-slate-350">
            <span className="flex items-center gap-1.5">
              <Megaphone className="h-3 w-3 text-emerald-400" />
              Posts Comms:
            </span>
            <span className="text-white font-extrabold">
              {dataByMuni[hoveredMuni.id]?.count_comunicacao || 0}
            </span>
          </div>

          <div className="text-[9px] text-slate-400 mt-1 italic border-t border-slate-800 pt-1.5 leading-relaxed">
            Última visita: {dataByMuni[hoveredMuni.id]?.ultima_visita 
              ? new Date(dataByMuni[hoveredMuni.id].ultima_visita as string).toLocaleDateString('pt-BR') 
              : "Sem visitas registradas"}
          </div>
        </div>
      )}
    </div>
  );
}
