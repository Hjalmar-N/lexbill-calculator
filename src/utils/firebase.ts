import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyALHrSJ21bg4Dek2kR0u6t3edp-59wA6wg",
  authDomain: "lexbill.firebaseapp.com",
  projectId: "lexbill",
  storageBucket: "lexbill.firebasestorage.app",
  messagingSenderId: "105144135443",
  appId: "1:105144135443:web:f69fb83f3d9784aa4db4e6",
  measurementId: "G-2D9SHT2ZLG"
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
