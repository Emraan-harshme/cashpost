export default function LoadingSpinner() {
  return (
    <div className="flex flex-col justify-center items-center p-10 gap-3">
      <div className="animate-spin border-lime-400 border-t-transparent rounded-full w-8 h-8 border-2"></div>
      <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-lime-400/70 animate-pulse">loading</span>
    </div>
  );
}
