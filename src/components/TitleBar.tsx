export default function TitleBar() {
  return (
    <div className="flex items-center justify-between h-8 bg-[#060910] px-4 select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <span className="text-xs font-semibold text-gray-400 tracking-wide">AdOS</span>
      <div className="flex gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => (window as any).ados?.window.minimize()}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400"
        >
          ─
        </button>
        <button
          onClick={() => (window as any).ados?.window.maximize()}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400"
        >
          □
        </button>
        <button
          onClick={() => (window as any).ados?.window.close()}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-600 text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
