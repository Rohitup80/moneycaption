import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { creatorName, creatorEmail, platforms, screenshotUrl } = await request.json();
    
    console.log(`\n==================================================`);
    console.log(`📬 [EMAIL SIMULATION] Admin Notification: Profile Verification Request`);
    console.log(`To: [EMAIL_ADDRESS]`);
    console.log(`Subject: 🛡️ PROFILE VERIFICATION REQUEST: ${creatorName}`);
    console.log(`Message:`);
    console.log(`A creator has requested verification of their social profile links:`);
    console.log(`- Creator Name: ${creatorName}`);
    console.log(`- Creator Email: ${creatorEmail}`);
    console.log(`- Platforms: ${platforms.join(", ")}`);
    console.log(`- Screenshot: ${screenshotUrl || "No screenshot uploaded yet"}`);
    console.log(`Action Required: Verify handles manually and approve at:`);
    console.log(`🔗 http://localhost:3000/admin/review`);
    console.log(`==================================================\n`);

    return NextResponse.json({
      success: true,
      message: "Profile verification request sent to administrator (simulated).",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to notify administrator" },
      { status: 500 }
    );
  }
}
