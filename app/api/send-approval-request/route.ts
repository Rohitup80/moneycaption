import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { creatorName, creatorEmail, niche, city } = await request.json();
    
    console.log(`\n==================================================`);
    console.log(`📬 [EMAIL SIMULATION] Admin Instant Review Alert!`);
    console.log(`To: [EMAIL_ADDRESS]`);
    console.log(`Subject: ⚡ INSTANT REVIEW REQUEST: ${creatorName}`);
    console.log(`Message:`);
    console.log(`A creator has requested an instant validation of their account:`);
    console.log(`- Creator Name: ${creatorName}`);
    console.log(`- Creator Email: ${creatorEmail}`);
    console.log(`- Niche: ${niche}`);
    console.log(`- City: ${city}`);
    console.log(`Action Required: Review and approve at:`);
    console.log(`🔗 http://localhost:3000/admin/review`);
    console.log(`==================================================\n`);

    return NextResponse.json({
      success: true,
      message: "Notification sent successfully to [EMAIL_ADDRESS] (simulated).",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to notify administrator" },
      { status: 500 }
    );
  }
}
