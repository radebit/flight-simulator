// A320-interior.xml at the pinned FlightGear revision positions the cockpit at
// x=-16.47411, y=-0.00015, z=-0.09483 metres. AC3D/Three axes are (x, z, -y).
// The airport uses the exterior GLB origin raised to put its tyres on the apron.
export const AIRFRAME_GROUND_HEIGHT = 4.39
export const COCKPIT_IN_AIRFRAME: [number, number, number] = [-16.47411, -.09483, .00015]
export const AIRPORT_IN_COCKPIT: [number, number, number] = [16.47411, .09483 - AIRFRAME_GROUND_HEIGHT, -.00015]
