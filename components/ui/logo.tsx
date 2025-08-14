export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">R</span>
      </div>
      <span className="font-semibold text-slate-100">Solmix</span>
    </div>
  );
}
