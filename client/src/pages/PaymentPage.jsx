import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export default function PaymentPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (bookingId) {
      axios.get("/bookings").then((response) => {
        const foundBooking = response.data.find(({ _id }) => _id === bookingId);
        if (foundBooking) {
          setBooking(foundBooking);
        }
        setLoading(false);
      });
    }
  }, [bookingId]);

  const handlePayment = async () => {
    try {
      setProcessing(true);
      const stripe = await stripePromise;
      
      // Create a payment session on the server
      const response = await axios.post('/create-payment-session', {
        bookingId,
        amount: booking.price,
      });

      // Redirect to Stripe Checkout
      const result = await stripe.redirectToCheckout({
        sessionId: response.data.sessionId,
      });

      if (result.error) {
        alert(result.error.message);
      }
    } catch (error) {
      console.error('Payment failed:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="text-center mt-8">Loading...</div>;
  }

  if (!booking) {
    return <div className="text-center mt-8">Booking not found</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-6">
      <h1 className="text-3xl mb-6">Complete Your Payment</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-6">
          <h2 className="text-xl mb-2">Booking Details</h2>
          <p className="text-gray-600">{booking.place.title}</p>
          <p className="text-gray-600">{booking.place.address}</p>
        </div>
        <div className="mb-6">
          <h2 className="text-xl mb-2">Payment Summary</h2>
          <div className="flex justify-between items-center">
            <span>Total Amount:</span>
            <span className="text-2xl font-bold">${booking.price}</span>
          </div>
        </div>
        <button
          onClick={handlePayment}
          disabled={processing}
          className={`w-full bg-primary text-white py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors ${
            processing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {processing ? 'Processing...' : 'Proceed to Payment'}
        </button>
      </div>
    </div>
  );
} 