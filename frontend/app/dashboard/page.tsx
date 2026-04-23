import Container from '@/components/common/container';

export default function Dashboard() {
    return (
        <Container className="pt-16 pl-52">
            <div className="h-[90vh] rounded-tl-2xl border-t border-l border-dashed">
                <div className="p-8">
                    <h1 className="text-2xl font-semibold tracking-tight">Welcome Back, Nikhil</h1>
                    <p className="mt-2">Your last claim resolved 2 hours ago · Earned +12.5 OPAL</p>
                </div>
            </div>
        </Container>
    );
}
