import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CalendarAppointment } from '../../types';

interface AppointmentsMapProps {
    appointments: CalendarAppointment[];
    previewLocation?: { lat: number; lng: number; label: string } | null;
}

const ITALY_CENTER: [number, number] = [12.5, 42.5];

const AppointmentsMap: React.FC<AppointmentsMapProps> = ({ appointments, previewLocation }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<maplibregl.Marker[]>([]);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: ITALY_CENTER,
            zoom: 5,
            pitch: 60,
            maxPitch: 85,
            bearing: -12,
            dragRotate: true,
            touchPitch: true,
            antialias: true,
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
        mapRef.current = map;

        map.on('load', () => {
            // Cielo + edifici estrusi in 3D per una resa più realistica quando si è vicini al suolo
            map.setSky({
                'sky-color': '#1e90ff',
                'sky-horizon-blend': 0.5,
                'horizon-color': '#ffffff',
                'horizon-fog-blend': 0.5,
                'fog-color': '#bcd9ff',
                'fog-ground-blend': 0.3,
            } as any);

            const layers = map.getStyle().layers || [];
            const hasBuildingSource = layers.some(l => (l as any)['source-layer'] === 'building');
            if (hasBuildingSource) {
                const firstSymbolLayer = layers.find(l => l.type === 'symbol')?.id;
                map.addLayer({
                    id: 'buildings-3d',
                    type: 'fill-extrusion',
                    source: layers.find(l => (l as any)['source-layer'] === 'building')!.source as string,
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
        });

        const resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            map.remove();
            mapRef.current = null;
        };
    }, []);

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

    return <div ref={containerRef} className="w-full h-full" />;
};

export default AppointmentsMap;
