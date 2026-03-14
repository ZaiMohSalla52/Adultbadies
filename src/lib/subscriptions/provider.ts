export type CheckoutSessionInput = {
  userId: string;
  email?: string;
  planCode: string;
  successUrl: string;
  cancelUrl: string;
};

export const createCheckoutSession = async (input: CheckoutSessionInput): Promise<{ checkoutUrl: string }> => {
  void input;
  throw new Error('Billing provider integration is not configured yet.');
};
