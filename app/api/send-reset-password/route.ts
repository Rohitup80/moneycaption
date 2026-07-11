import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    
    console.log(`\n==================================================`);
    console.log(`📬 [EMAIL SIMULATION] Password Reset Link Sent!`);
    console.log(`To: ${email}`);
    console.log(`Subject: Reset your MoneyCaption password`);
    console.log(`Message: Click the link below to configure your new password:`);
    console.log(`🔗 http://localhost:3000/profile?reset=true&email=${encodeURIComponent(email)}`);
    console.log("Note: This reset link redirects directly to your dashboard recovery panel.");
    console.log(`==================================================\n`);

    return NextResponse.json({
      success: true,
      message: "Password reset link sent (simulated). Check your console logs.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to trigger password recovery" },
      { status: 500 }
    );
  }
}
