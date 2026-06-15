import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CalendarAppointment } from '../../types';

interface AppointmentsMapProps {
    appointments: CalendarAppointment[];
    previewLocation?: { lat: number; lng: number; label: string } | null;
    focusLocation?: { lat: number; lng: number } | null;
}

const ITALY_CENTER: [number, number] = [12.5, 42.5];

type MapStyleKey = 'liberty' | 'bright' | 'positron' | 'dark';

const MAP_STYLES: { key: MapStyleKey; label: string }[] = [
    { key: 'liberty', label: 'Liberty' },
    { key: 'bright', label: 'Bright' },
    { key: 'positron', label: 'Chiaro' },
    { key: 'dark', label: 'Scuro' },
];

// Stili gratuiti, nessuna API key: OpenFreeMap (vettoriale) per liberty/bright/positron,
// raster CartoDB Dark Matter per la modalità scura.
function getMapStyle(style: MapStyleKey): string | maplibregl.StyleSpecification {
    switch (style) {
        case 'bright':
            return 'https://tiles.openfreemap.org/styles/bright';
        case 'positron':
            return 'https://tiles.openfreemap.org/styles/positron';
        case 'dark':
            return {
                version: 8,
                sources: {
                    'carto-dark': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                        ],
                        tileSize: 256,
                        attribution: '© OpenStreetMap contributors, © CartoDB',
                        maxzoom: 19,
                    },
                },
                layers: [{ id: 'carto-dark-layer', type: 'raster', source: 'carto-dark' }],
            };
        case 'liberty':
        default:
            return 'https://tiles.openfreemap.org/styles/liberty';
    }
}

const AppointmentsMap: React.FC<AppointmentsMapProps> = ({ appointments, previewLocation, focusLocation }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<maplibregl.Marker[]>([]);
    const isFirstStyleRender = useRef(true);

    const [mapStyle, setMapStyle] = useState<MapStyleKey>('liberty');
    const [tilt, setTilt] = useState(60);
    const [rotation, setRotation] = useState(-12);
    const [autoRotate, setAutoRotate] = useState(false);

    // Aggiunge cielo + edifici estrusi in 3D (se lo stile espone la source-layer "building")
    const applySceneExtras = (map: maplibregl.Map) => {
        map.setSky({
            'sky-color': '#1e90ff',
            'sky-horizon-blend': 0.5,
            'horizon-color': '#ffffff',
            'horizon-fog-blend': 0.5,
            'fog-color': '#bcd9ff',
            'fog-ground-blend': 0.3,
        } as any);

        const layers = map.getStyle().layers || [];
        const buildingLayer = layers.find(l => (l as any)['source-layer'] === 'building');
        if (buildingLayer && !map.getLayer('buildings-3d')) {
            const firstSymbolLayer = layers.find(l => l.type === 'symbol')?.id;
            map.addLayer({
                id: 'buildings-3d',
                type: 'fill-extrusion',
                source: buildingLayer.source as string,
                'source-layer': 'building',
                minzoom: 13,
                paint: {
                    'fill-extrusion-color': '#cfd8e6',
                    'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
                    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
                    'fill-extrusion-opacity': 0.85,
                },
            }, firstSymbolLayer);
        }
    };

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: getMapStyle(mapStyle),
            center: ITALY_CENTER,
            zoom: 5,
            pitch: tilt,
            maxPitch: 85,
            bearing: rotation,
            dragRotate: true,
            touchPitch: true,
            antialias: true,
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
        mapRef.current = map;

        map.on('load', () => applySceneExtras(map));

        const resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Cambio stile mappa (ricarica gli edifici 3D/cielo dopo il restyle)
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (isFirstStyleRender.current) {
            isFirstStyleRender.current = false;
            return;
        }
        map.setStyle(getMapStyle(mapStyle));
        map.once('style.load', () => applySceneExtras(map));
    }, [mapStyle]);

    // Applica inclinazione (pitch) e rotazione (bearing) reali della camera 3D
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        map.easeTo({ pitch: tilt, bearing: rotation, duration: autoRotate ? 0 : 300 });
    }, [tilt, rotation, autoRotate]);

    // Rotazione orbitale automatica
    useEffect(() => {
        if (!autoRotate) return;
        const interval = setInterval(() => {
            setRotation(prev => {
                const next = prev + 0.6;
                return next > 45 ? -45 : next;
            });
        }, 100);
        return () => clearInterval(interval);
    }, [autoRotate]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const updateMarkers = () => {
            markersRef.current.forEach(marker => marker.remove());
            markersRef.current = [];

            const bounds = new maplibregl.LngLatBounds();
            let hasPoints = false;

            appointments.forEach(app => {
                if (app.location_lat == null || app.location_lng == null) return;
                const el = document.createElement('div');
                el.style.fontSize = '24px';
                el.style.lineHeight = '1';
                el.style.cursor = 'pointer';
                el.textContent = '🚩';

                const dateLabel = new Date(app.appointment_date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
                const leadName = (app.leads?.data as Record<string, string> | undefined)?.nome || (app.leads?.data as Record<string, string> | undefined)?.azienda || 'Cliente';
                const popupHtml = `
                    <div style="font-size:13px;line-height:1.4">
                        <strong>${leadName}</strong><br/>
                        ${dateLabel} alle ${app.appointment_time?.substring(0, 5)} (${app.duration_hours}h)<br/>
                        ${app.location_address || ''}
                    </div>
                `;

                const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                    .setLngLat([app.location_lng, app.location_lat])
                    .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML(popupHtml))
                    .addTo(map);

                markersRef.current.push(marker);
                bounds.extend([app.location_lng, app.location_lat]);
                hasPoints = true;
            });

            if (previewLocation) {
                const el = document.createElement('div');
                el.style.fontSize = '28px';
                el.style.lineHeight = '1';
                el.textContent = '📍';

                const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                    .setLngLat([previewLocation.lng, previewLocation.lat])
                    .setPopup(new maplibregl.Popup({ offset: 20 }).setText(previewLocation.label || 'Nuovo appuntamento'))
                    .addTo(map);

                markersRef.current.push(marker);
                bounds.extend([previewLocation.lng, previewLocation.lat]);
                hasPoints = true;
            }

            if (hasPoints) {
                map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 500 });
            }
        };

        if (map.isStyleLoaded()) {
            updateMarkers();
        } else {
            map.once('load', updateMarkers);
        }
    }, [appointments, previewLocation]);

    // Centra la mappa sull'appuntamento selezionato dalla lista "Appuntamenti in programma"
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !focusLocation) return;

        const doFly = () => map.flyTo({ center: [focusLocation.lng, focusLocation.lat], zoom: 15, duration: 800 });

        if (map.isStyleLoaded()) {
            doFly();
        } else {
            map.once('load', doFly);
        }
    }, [focusLocation]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full" />

            {/* HUD: selettore stile mappa + controlli inclinazione/rotazione 3D */}
            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 pointer-events-none">
                <div className="flex gap-1 bg-slate-900/80 backdrop-blur-sm p-1 rounded-lg shadow-lg pointer-events-auto">
                    {MAP_STYLES.map(s => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => setMapStyle(s.key)}
                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors ${
                                mapStyle === s.key ? 'bg-sky-500 text-white' : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-sm p-1 rounded-lg shadow-lg pointer-events-auto">
                    <button
                        type="button"
                        title="Inclinazione -"
                        onClick={() => { setAutoRotate(false); setTilt(t => Math.max(0, t - 10)); }}
                        className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                        Tilt -
                    </button>
                    <button
                        type="button"
                        title="Inclinazione +"
                        onClick={() => { setAutoRotate(false); setTilt(t => Math.min(85, t + 10)); }}
                        className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                        Tilt +
                    </button>
                    <button
                        type="button"
                        title="Ruota a sinistra"
                        onClick={() => { setAutoRotate(false); setRotation(r => r - 15); }}
                        className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                        ⟲
                    </button>
                    <button
                        type="button"
                        title="Ruota a destra"
                        onClick={() => { setAutoRotate(false); setRotation(r => r + 15); }}
                        className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                        ⟳
                    </button>
                    <button
                        type="button"
                        title="Rotazione automatica"
                        onClick={() => setAutoRotate(a => !a)}
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                            autoRotate ? 'bg-sky-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                    >
                        Auto
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AppointmentsMap;
