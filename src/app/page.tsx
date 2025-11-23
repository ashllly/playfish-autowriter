export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
      <p className="text-4xl font-bold mb-4">Playfish AutoWriter</p>
      <p className="text-lg text-slate-300">
        如果你能看到这一页，说明本地开发服务器已正常运行。
      </p>
      <p className="text-sm text-slate-500 mt-6">
        接下来可以访问 <span className="text-slate-200 font-medium">/dashboard</span> 体验实际功能。
      </p>
    </div>
  );
}
