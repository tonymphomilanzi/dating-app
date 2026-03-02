export default function Avatar({ src, size = 64 }) {
  return (
    <img
      src={src || "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=400&auto=format&fit=crop"}
      alt=""
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}