import clsx from "clsx";
export default function Tag({ label, active, onClick }) {
  return (
    <button onClick={onClick} className={clsx("chip", active ? "chip-on" : "chip-off")}>
      {label}
    </button>
  );
}