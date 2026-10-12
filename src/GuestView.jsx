export default function GuestView() {
  return (
    <div className="flex h-dvh w-screen flex-col bg-background">
      <button className="h-1/2 w-full border-b border-text-secondary/30 bg-white/5 text-2xl font-bold tracking-widest text-text-primary backdrop-blur-xl">
        REAL
      </button>
      <button className="h-1/2 w-full bg-white/5 text-2xl font-bold tracking-widest text-text-primary backdrop-blur-xl">
        AI GENERATED
      </button>
    </div>
  )
}
