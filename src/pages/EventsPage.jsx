// Example usage snippet
import { useEffect, useState } from "react";
import { eventsService } from "../services/events.service.js";

export default function EventsPage(){
  const [events, setEvents] = useState([]);
  useEffect(()=>{ eventsService.list().then(setEvents).catch(console.error); }, []);
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-3">Events</h1>
      <div className="space-y-3">
        {events.map(e=>(
          <div key={e.id} className="rounded-2xl bg-white p-4 shadow-card">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold">{e.title}</div>
                <div className="text-sm text-gray-500">{new Date(e.starts_at).toLocaleString()}</div>
              </div>
              {e.distance_km != null && <div className="text-xs text-gray-600">{e.distance_km} km</div>}
            </div>
            <p className="mt-2 text-sm text-gray-700 line-clamp-2">{e.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}