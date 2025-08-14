import ConnectionStatus from "@/components/ui/connection-status"

interface StatusBarProps {
  solidityVersion?: string
  isConnected?: boolean
  networkName?: string
}

export default function StatusBar({
  solidityVersion = "0.8.19",
  isConnected = true,
  networkName = "Connected",
}: StatusBarProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span>Solidity {solidityVersion}</span>
      <ConnectionStatus isConnected={isConnected} status={networkName} />
    </div>
  )
}
