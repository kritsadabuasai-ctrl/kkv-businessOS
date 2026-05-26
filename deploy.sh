# 1. Build Image และเก็บไว้บน Google Artifact Registry
gcloud builds submit --tag gcr.io/steel-time-485912-m1/kkv-backend

# 2. Deploy ขึ้น Cloud Run
gcloud run deploy kkv-backend \
  --image gcr.io/steel-time-485912-m1/kkv-backend \
  --platform managed \
  --region asia-southeast3 \
  --allow-unauthenticated \
  --add-cloudsql-instances steel-time-485912-m1:asia-southeast3:kkv-service \
  --set-env-vars DATABASE_URL="postgresql://postgres:%3DS%2C1%25Q%23mTN%7D%2B7%2B-=@127.0.0.1:5432/kkv_business_db?schema=public"