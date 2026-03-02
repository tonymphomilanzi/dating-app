import clsx from "clsx";

export default function Button({ className, variant = "primary", ...props }) {
  return (
    <button
      className={clsx(
        variant === "primary" && "btn-primary",
        variant === "outline" && "btn-outline",
        variant === "ghost" && "btn",
        className
      )}
      {...props}
    />
  );
}