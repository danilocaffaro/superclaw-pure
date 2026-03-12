/**
 * Clean agent display names.
 *
 * Rules:
 *   "my-agent"      → "My-agent" (capitalize first letter)
 *   "agent (team)"  → "Agent | for Team"
 *   ""              → capitalize(id)
 */
export function cleanAgentName(id: string, rawName: string): string {
  if (!rawName || rawName === id) {
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  // Persona pattern: "Name (target)" → "Name | for Target"
  const personaMatch = rawName.match(/^(.+?)\s*\((\w+)\)$/);
  if (personaMatch) {
    const base = personaMatch[1].trim();
    const target = personaMatch[2].charAt(0).toUpperCase() + personaMatch[2].slice(1);
    return `${base} | for ${target}`;
  }

  return rawName;
}
