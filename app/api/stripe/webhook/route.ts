import Stripe from "stripe";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Webhook signature verification failed", error);
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription && session.customer) {
          await prisma.subscription.updateMany({
            where: { stripeCustomerId: session.customer as string },
            data: {
              stripeSubscriptionId: session.subscription as string,
              status: "active"
            }
          });
          await prisma.user.updateMany({
            where: { id: session.metadata?.userId },
            data: { role: "PRO" }
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000)
          }
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: subscription.status
          }
        });
        await prisma.user.updateMany({
          where: { subscription: { is: { stripeSubscriptionId: subscription.id } } },
          data: { role: "FREE" }
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Error handling webhook", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
