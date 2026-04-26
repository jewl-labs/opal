import Container from '@/components/common/container';

export default function DashboardPage() {
  return (
    <Container className="pt-16 px-6 h-screen">
      <div className="rounded-b-2xl h-[80vh] border-b border-x border-dashed">
        <div className="p-8">   
          <h1 className="text-2xl font-semibold tracking-tighter">
            Welcome Back, Nikhil
          </h1>
          <p className="mt-2">
            Your last claim resolved 2 hours ago · Earned +12.5 OPAL
          </p>
        </div>
      </div>
    </Container>
  );
}
