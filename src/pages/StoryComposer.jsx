import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import { storiesService } from "../services/stories.service.js";

export default function StoryComposer() {
  const nav = useNavigate();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const pick = () => fileRef.current?.click();
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr("");
    const isImgOrVideo = f.type.startsWith("image/") || f.type.startsWith("video/");
    if (!isImgOrVideo) { setErr("Only image/video supported"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!file) { setErr("Choose a media file"); return; }
    setSaving(true);
    try {
      await storiesService.add({ file, caption });
      nav(-1); // back to Discover (stories row will refresh next mount)
    } catch (e) {
      setErr(e.message || "Failed to post story");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white">
      <TopBar title="Add story" />
      <div className="space-y-4 p-5">
        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

        <div className="rounded-2xl border border-dashed border-gray-300 p-5 text-center">
          {!preview ? (
            <>
              <p className="text-sm text-gray-600">Upload an image (or short video)</p>
              <Button className="mt-3" variant="outline" onClick={pick}>
                <i className="lni lni-camera mr-1" /> Choose media
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              {file?.type.startsWith("video/") ? (
                <video src={preview} controls className="mx-auto max-h-96 rounded-xl" />
              ) : (
                <img src={preview} className="mx-auto max-h-96 rounded-xl object-contain" />
              )}
              <Button variant="outline" onClick={pick}>Change</Button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFile}/>
        </div>

        <div>
          <label className="text-sm font-medium">Caption (optional)</label>
          <textarea rows={3} value={caption} onChange={(e)=>setCaption(e.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
            placeholder="Say something…"
          />
        </div>

        <Button className="w-full" disabled={!file || saving} onClick={save}>
          {saving ? "Posting…" : "Post story"}
        </Button>
      </div>
    </div>
  );
}