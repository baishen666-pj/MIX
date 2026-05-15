// Shared SVG defs for furniture gradients
// Render once inside the IsoScene <svg> element
export function FurnitureDefs() {
  return (
    <defs>
      <filter id="furniture-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
      </filter>
    </defs>
  )
}
