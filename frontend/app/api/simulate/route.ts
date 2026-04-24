import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, from, chainId } = body;

    if (!to || !from || !chainId) {
      return NextResponse.json(
        { error: 'Missing required parameters: to, from, chainId' },
        { status: 400 }
      );
    }

    // In a production app, we would make an eth_call to an RPC provider
    // or use Tenderly simulation API here.
    // For Milestone 2, we simulate success with a delay to demonstrate the UX.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return NextResponse.json({
      success: true,
      gasUsed: 250000,
      expectedOutput: 'Simulated successful execution',
    });
  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { error: 'Failed to simulate transaction' },
      { status: 500 }
    );
  }
}
