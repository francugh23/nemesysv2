const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-cover bg-center flex items-center justify-end px-6 lg:px-20"
      style={{
        backgroundImage: "url('/login-bg.jpg')",
      }}
    >
      {/* Emerald Overlay */}
      <div className="absolute inset-0 bg-emerald-950/60" />

      {/* Branding */}
      <div className="absolute left-8 lg:left-20 top-1/2 -translate-y-1/2 text-white z-10 max-w-lg hidden md:block animate-in fade-in slide-in-from-left-8 ">
        <h1 className="text-5xl font-bold tracking-tight">
          NEMESYS
        </h1>
        <p className="mt-3 text-xl font-semibold  ">
          NVGCHS Enrollment Management System
        </p>

        <p className="mt-5 text-sm text-white/80 font-light          ">
          Efficient. Secured. Connected.
        </p>
      </div>

      {/* Login */}
      <div className="justify-items-center w-full max-w-md animate-in fade-in slide-in-from-right-8 duration-700">
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
