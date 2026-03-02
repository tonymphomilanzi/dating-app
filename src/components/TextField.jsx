export default function TextField({ label, placeholder, type = "text", right, ...props }) {
  return (
    <label className="block space-y-2">
      {label && <span className="text-sm text-gray-600">{label}</span>}
      <div className="relative">
        <input className="field pr-12" placeholder={placeholder} type={type} {...props} />
        {right && <div className="absolute inset-y-0 right-0 flex items-center pr-3">{right}</div>}
      </div>
    </label>
  );
}