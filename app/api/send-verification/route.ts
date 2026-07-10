import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();
    
    console.log(`\n==================================================`);
    console.log(`📬 [EMAIL SIMULATION] Verification Link Sent!`);
    console.log(`To: ${name} <${email}>`);
    console.log(`Subject: Verify your MoneyCaption account`);
    console.log(`Message: Click the link below to verify your email address:`);
    console.log(`🔗 http://localhost:3000/profile?verified=true&email=${encodeURIComponent(email)}`);
    console.log(`==================================================\n`);

    return NextResponse.json({
      success: true,
      message: "Verification email sent (simulated). Check your console logs.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to send verification email" },
      { status: 500 }
    );
  }
}
