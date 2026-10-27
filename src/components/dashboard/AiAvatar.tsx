import { IconSparkle } from "@/components/icons";
import type { AiAgent } from "@/lib/types";

// Foto del agente IA (o un icono si no tiene).
export function AiAvatar({ agent, size = 36 }: { agent: Pick<AiAgent, "name" | "avatar">; size?: number }) {
  if (agent.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={agent.avatar} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="grid shrink-0 place-items-center rounded-full bg-zinc-200 text-zinc-600" style={{ width: size, height: size }}>
      <IconSparkle width={size * 0.5} height={size * 0.5} />
    </div>
  );
}
