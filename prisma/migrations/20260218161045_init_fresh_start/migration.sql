-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "ResetCriteria" AS ENUM ('DAILY', 'MONTHLY', 'YEARLY', 'NEVER');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VoteRule" AS ENUM ('ANY_APPROVE', 'ALL_MUST_APPROVE');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('INDIVIDUAL', 'CORPORATE', 'BRANCH');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('TEXT', 'LOCAL', 'GOOGLE_DRIVE', 'WEBSITE');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('PROBATION', 'CONFIRMED', 'NOTICE_PERIOD', 'RESIGNED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ProductSalesType" AS ENUM ('RETAIL', 'WHOLESALE', 'BOTH');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'DIGITAL');

-- CreateEnum
CREATE TYPE "ImageSource" AS ENUM ('GOOGLE_CLOUD', 'EXTERNAL', 'LOCAL', 'GOOGLE_DRIVE');

-- CreateEnum
CREATE TYPE "ImageGenerationType" AS ENUM ('ORIGINAL', 'AI_NO_BG', 'AI_ENHANCED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "AiProcessStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ShippingCalcType" AS ENUM ('PRICE_BASED', 'WEIGHT_BASED', 'FLAT_RATE');

-- CreateEnum
CREATE TYPE "RmaType" AS ENUM ('REFUND', 'EXCHANGE', 'REPAIR');

-- CreateEnum
CREATE TYPE "RmaStatus" AS ENUM ('PENDING', 'APPROVED', 'SHIPPING', 'RECEIVED', 'CHECKING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockChangeType" AS ENUM ('SALE', 'PURCHASE', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT', 'WASTE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_UPDATE', 'PROMOTION', 'SYSTEM', 'REWARD');

-- CreateEnum
CREATE TYPE "AuthProviderType" AS ENUM ('EMAIL', 'GOOGLE', 'FACEBOOK', 'LINE', 'THAID', 'PAOTANG', 'NDID');

-- CreateEnum
CREATE TYPE "DayRelative" AS ENUM ('PREVIOUS', 'CURRENT', 'NEXT');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('WORK_DAY', 'OFF_DAY');

-- CreateEnum
CREATE TYPE "GenderRule" AS ENUM ('ALL', 'MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "AccrualType" AS ENUM ('LUMP_SUM', 'MONTHLY_ACCRUAL');

-- CreateEnum
CREATE TYPE "RoundingRule" AS ENUM ('NO_ROUNDING', 'ROUND_UP_FULL', 'ROUND_DOWN_FULL', 'ROUND_UP_HALF', 'ROUND_DOWN_HALF', 'ROUND_NEAREST_HALF');

-- CreateEnum
CREATE TYPE "RoundingType" AS ENUM ('WHOLE', 'DIGIT');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('INCREASE', 'DECREASE', 'SET');

-- CreateEnum
CREATE TYPE "LeaveDurationRule" AS ENUM ('FULL_DAY_ONLY', 'HALF_DAY_RESOLUTION', 'HOURLY');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "sys_packages" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "maxCompanies" INTEGER NOT NULL DEFAULT 1,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxStorageMB" INTEGER NOT NULL DEFAULT 1000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sys_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_package_modules" (
    "packageId" INTEGER NOT NULL,
    "moduleId" INTEGER NOT NULL,

    CONSTRAINT "sys_package_modules_pkey" PRIMARY KEY ("packageId","moduleId")
);

-- CreateTable
CREATE TABLE "org_companies" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#4F46E5',
    "secondaryColor" TEXT,
    "companyType" "CompanyType" NOT NULL DEFAULT 'CORPORATE',
    "packageId" INTEGER,
    "parentId" INTEGER,
    "packageExpiresAt" TIMESTAMP(3),
    "licenseHolderId" INTEGER,
    "freeCredits" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "paidCredits" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_company_infos" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "taxId" TEXT,
    "branchCode" TEXT DEFAULT '00000',
    "registeredName" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "address" TEXT,
    "subDistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "zipCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_company_infos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "int_cloud_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "configName" TEXT NOT NULL,
    "configData" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "int_cloud_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "int_ai_bots" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "systemPrompt" TEXT NOT NULL,
    "greetingMessage" TEXT,
    "canUseTools" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "int_ai_bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "int_knowledge_bases" (
    "id" SERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL DEFAULT 'TEXT',
    "fileId" TEXT,
    "url" TEXT,
    "fileName" TEXT,
    "fileSize" BIGINT NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "int_knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "int_line_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "channelName" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelSecret" TEXT NOT NULL,
    "channelToken" TEXT NOT NULL,
    "liffIdMain" TEXT,
    "webhookUrl" TEXT,
    "aiBotId" INTEGER,
    "isAiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "int_line_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "int_facebook_pages" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "aiBotId" INTEGER,
    "isAiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "int_facebook_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_modules" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sys_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_subscriptions" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sec_users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "fullName" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockoutExpires" TIMESTAMP(3),
    "lineUserId" TEXT,
    "isNotified" BOOLEAN NOT NULL DEFAULT true,
    "googleId" TEXT,
    "facebookId" TEXT,
    "thaiId" TEXT,
    "paotangId" TEXT,
    "ndidId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sec_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sec_roles" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isOrderNotified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sec_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sec_user_roles" (
    "userId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "sec_user_roles_pkey" PRIMARY KEY ("userId","roleId","companyId")
);

-- CreateTable
CREATE TABLE "sec_permissions" (
    "id" SERIAL NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "moduleId" INTEGER,

    CONSTRAINT "sec_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sec_role_permissions" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "sec_role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "sec_menus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "icon" TEXT,
    "parentId" INTEGER,
    "moduleId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sec_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sec_company_menu_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "menuId" INTEGER NOT NULL,
    "showInSidebar" BOOLEAN NOT NULL DEFAULT true,
    "showInNavbar" BOOLEAN NOT NULL DEFAULT false,
    "isShortcut" BOOLEAN NOT NULL DEFAULT false,
    "customLabel" TEXT,
    "customIcon" TEXT,
    "sortOrder" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sec_company_menu_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sec_role_menus" (
    "roleId" INTEGER NOT NULL,
    "menuId" INTEGER NOT NULL,
    "sortOrder" INTEGER,

    CONSTRAINT "sec_role_menus_pkey" PRIMARY KEY ("roleId","menuId")
);

-- CreateTable
CREATE TABLE "sec_password_policies" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER,
    "minLength" INTEGER NOT NULL DEFAULT 8,
    "requireUpper" BOOLEAN NOT NULL DEFAULT true,
    "requireLower" BOOLEAN NOT NULL DEFAULT true,
    "requireNumber" BOOLEAN NOT NULL DEFAULT true,
    "requireSpecial" BOOLEAN NOT NULL DEFAULT true,
    "specialChars" TEXT NOT NULL DEFAULT '!@#$%^&*',
    "passwordAgeDays" INTEGER NOT NULL DEFAULT 90,
    "historyCount" BOOLEAN NOT NULL DEFAULT true,
    "maxLoginAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockoutDuration" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sec_password_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sec_user_delegations" (
    "id" SERIAL NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "delegateUserId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "sec_user_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfg_master_groups" (
    "id" SERIAL NOT NULL,
    "groupCode" TEXT NOT NULL,
    "groupName" TEXT,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cfg_master_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfg_master_data" (
    "id" SERIAL NOT NULL,
    "masterGroupId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "labels" JSONB NOT NULL,
    "parentId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "colorCode" TEXT,

    CONSTRAINT "cfg_master_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfg_running_formats" (
    "id" SERIAL NOT NULL,
    "docCode" TEXT NOT NULL,
    "docName" TEXT,
    "formatPattern" TEXT NOT NULL,
    "digitLength" INTEGER NOT NULL DEFAULT 5,
    "resetCriteria" "ResetCriteria" NOT NULL DEFAULT 'MONTHLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cfg_running_formats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfg_running_counters" (
    "id" SERIAL NOT NULL,
    "formatId" INTEGER NOT NULL,
    "companyId" INTEGER,
    "periodKey" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cfg_running_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfg_system_configs" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "cfg_system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_templates" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'th',
    "subject" TEXT,
    "content" TEXT NOT NULL,

    CONSTRAINT "com_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_message_logs" (
    "id" BIGSERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT,
    "status" TEXT NOT NULL,
    "apiResponse" JSONB,
    "errorMessage" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "com_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employees" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "employmentType" TEXT DEFAULT 'FULL_TIME',
    "title" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nickName" TEXT,
    "birthDate" TIMESTAMP(3),
    "phone" TEXT,
    "lineId" TEXT,
    "email" TEXT,
    "address" TEXT,
    "userId" INTEGER,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "confirmDate" TIMESTAMP(3),
    "resignDate" TIMESTAMP(3),
    "serviceBaseDate" TIMESTAMP(3),
    "status" "EmploymentStatus" NOT NULL DEFAULT 'PROBATION',
    "previousEmployeeId" INTEGER,
    "departmentId" INTEGER,
    "positionId" INTEGER,
    "managerId" INTEGER,
    "workPatternId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_infos" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "idCardNumber" TEXT,
    "passportNo" TEXT,
    "gender" TEXT,
    "birthDate" TIMESTAMP(3),
    "bloodGroup" TEXT,
    "nationality" TEXT,
    "religion" TEXT,
    "mobilePhone" TEXT,
    "personalEmail" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "address" TEXT,
    "subDistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "zipCode" TEXT,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_employee_infos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employment_periods" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reason" TEXT,
    "isDeductible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_employment_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_departments" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_positions" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "hr_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_job_history" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "positionId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_job_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_definitions" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "wf_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_nodes" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "nodeName" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverRoleId" INTEGER,
    "approverPositionId" INTEGER,
    "dynamicApprover" TEXT,
    "timeoutHours" INTEGER,
    "timeoutAction" TEXT,
    "voteRule" "VoteRule" NOT NULL DEFAULT 'ANY_APPROVE',
    "nextApproveId" INTEGER,
    "nextRejectId" INTEGER,

    CONSTRAINT "wf_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_requests" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "currentNodeId" INTEGER,
    "businessId" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "topic" TEXT,
    "requesterId" INTEGER NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wf_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_actions" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "onBehalfOfId" INTEGER,
    "stepName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wf_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_audits" (
    "id" BIGSERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "userId" INTEGER,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_members" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER,
    "memberCode" TEXT NOT NULL,
    "lineUserId" TEXT,
    "lineName" TEXT,
    "linePicture" TEXT,
    "idCardNumber" TEXT,
    "thaiId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isMarketingConsent" BOOLEAN NOT NULL DEFAULT true,
    "pointBalance" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_addresses" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "province" TEXT,
    "zipcode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_products" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" INTEGER,
    "productType" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
    "isCancellable" BOOLEAN NOT NULL DEFAULT true,
    "price" DECIMAL(10,2) NOT NULL,
    "minTierPrice" DECIMAL(10,2),
    "unit" TEXT NOT NULL DEFAULT 'ชิ้น',
    "brand" TEXT,
    "slug" TEXT,
    "defaultSupplierId" INTEGER,
    "salesType" "ProductSalesType" NOT NULL DEFAULT 'BOTH',
    "weight" DECIMAL(10,3),
    "width" DECIMAL(10,2),
    "length" DECIMAL(10,2),
    "height" DECIMAL(10,2),
    "ratingAvg" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "usageTags" TEXT[],
    "materialTags" TEXT[],
    "featuredImageUrl" TEXT,
    "descriptionVector" vector(1536),
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "costPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isPreOrder" BOOLEAN NOT NULL DEFAULT false,
    "daysToShip" INTEGER NOT NULL DEFAULT 2,
    "parentId" INTEGER,
    "variantAttributes" JSONB,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_product_images" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "source" "ImageSource" NOT NULL DEFAULT 'GOOGLE_CLOUD',
    "generationType" "ImageGenerationType" NOT NULL DEFAULT 'ORIGINAL',
    "parentId" INTEGER,
    "url" TEXT NOT NULL,
    "variantId" INTEGER,
    "displayName" TEXT,
    "fileId" TEXT,
    "colorCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fileName" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "imageVector" vector(1536),
    "aiStatus" "AiProcessStatus" NOT NULL DEFAULT 'PENDING',
    "aiError" TEXT,
    "aiLastRunAt" TIMESTAMP(3),

    CONSTRAINT "com_product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "int_ai_batch_jobs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "jobType" TEXT NOT NULL DEFAULT 'IMAGE_TAGGING',
    "status" "WorkflowStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "int_ai_batch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_ai_model_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER,
    "provider" TEXT NOT NULL,
    "modelCode" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "creditPer1kTokens" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "markupMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "maxContextTokens" INTEGER DEFAULT 128000,
    "isVisionSupported" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_ai_model_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "com_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_product_price_sets" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_product_price_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_product_tier_prices" (
    "id" SERIAL NOT NULL,
    "priceSetId" INTEGER NOT NULL,
    "minQty" INTEGER NOT NULL,
    "maxQty" INTEGER,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "com_product_tier_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_discounts" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'FIXED',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minPurchaseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxDiscountAmount" DOUBLE PRECISION,
    "isFreeShipping" BOOLEAN NOT NULL DEFAULT false,
    "appliesTo" TEXT NOT NULL DEFAULT 'ALL',
    "targetIds" JSONB,
    "maxUsageTotal" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsagePerUser" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_shipping_methods" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "calcType" "ShippingCalcType" NOT NULL DEFAULT 'PRICE_BASED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_shipping_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_shipping_rules" (
    "id" SERIAL NOT NULL,
    "methodId" INTEGER NOT NULL,
    "minAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "maxAmount" DECIMAL(10,2),
    "minWeight" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "maxWeight" DECIMAL(65,30),
    "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "com_shipping_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_announcements" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "type" TEXT NOT NULL DEFAULT 'POPUP',
    "position" TEXT NOT NULL DEFAULT 'HOME',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_orders" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "orderNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "shopId" INTEGER NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paymentType" TEXT NOT NULL DEFAULT 'FULL',
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountId" INTEGER,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shippingRuleId" INTEGER,
    "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shippingAddress" TEXT,
    "trackingNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_order_items" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "productSku" TEXT,
    "qty" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "purchaseItemId" INTEGER,
    "cancelReason" TEXT,
    "cancelledById" INTEGER,
    "wfRequestId" INTEGER,
    "itemStatus" TEXT NOT NULL DEFAULT 'WAITING_PO',
    "comment" TEXT,

    CONSTRAINT "com_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_payment_methods" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "config" JSONB,
    "instruction" TEXT,
    "qrImage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_payments" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "methodId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slipUrl" TEXT,
    "refNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedBy" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_suppliers" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "creditTerm" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "type" TEXT NOT NULL DEFAULT 'LOCAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_purchase_orders" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "docNo" TEXT NOT NULL,
    "docDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_purchase_items" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pro_purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_shop_profiles" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "googleAnalyticsId" TEXT,
    "facebookPixelId" TEXT,
    "tiktokPixelId" TEXT,
    "shopCode" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "webBaseUrl" TEXT,
    "lineOaUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#4F46E5',
    "secondaryColor" TEXT,
    "warehouseAddress" TEXT,
    "pickupAddress" TEXT,
    "returnAddress" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 7.0,
    "isVatIncluded" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT,
    "subDistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "zipCode" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "phone" TEXT,
    "isMainShop" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_shop_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_bank_accounts" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "branch" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_shop_products" (
    "shopId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priceOverride" DECIMAL(10,2),
    "featuredImageUrl" TEXT,
    "nameOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_shop_products_pkey" PRIMARY KEY ("shopId","productId")
);

-- CreateTable
CREATE TABLE "com_return_requests" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "shopId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "docNo" TEXT NOT NULL,
    "type" "RmaType" NOT NULL,
    "status" "RmaStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "proofImages" TEXT[],
    "customerTrackingNo" TEXT,
    "customerCourier" TEXT,
    "shopTrackingNo" TEXT,
    "refundAmount" DECIMAL(10,2),
    "refundSlipUrl" TEXT,
    "wfRequestId" INTEGER,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_return_items" (
    "id" SERIAL NOT NULL,
    "returnRequestId" INTEGER NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "targetProductId" INTEGER,
    "condition" TEXT,

    CONSTRAINT "com_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_stock_logs" (
    "id" BIGSERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "changeQty" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "type" "StockChangeType" NOT NULL,
    "refOrderId" INTEGER,
    "refPurchaseItemId" INTEGER,
    "refReturnId" INTEGER,
    "note" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "com_stock_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "int_ai_quotas" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'FREE',
    "maxSingleFileSize" INTEGER NOT NULL DEFAULT 10485760,
    "monthlyLimit" BIGINT NOT NULL DEFAULT 100000,
    "usedThisMonth" BIGINT NOT NULL DEFAULT 0,
    "maxStorageBytes" BIGINT NOT NULL DEFAULT 524288000,
    "usedStorageBytes" BIGINT NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "extraCredit" BIGINT NOT NULL DEFAULT 0,
    "lastResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "int_ai_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "int_ai_usage_logs" (
    "id" BIGSERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "aiBotId" INTEGER,
    "modelName" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "int_ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sec_company_security_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "menuId" INTEGER NOT NULL,
    "requireReAuth" BOOLEAN NOT NULL DEFAULT true,
    "requireMfa" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriod" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sec_company_security_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_point_logs" (
    "id" BIGSERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "refOrderId" INTEGER,
    "refRedemptionId" INTEGER,
    "note" TEXT,
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_point_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_rewards" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "pointCost" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DISCOUNT_COUPON',
    "discountTemplateId" INTEGER,
    "productId" INTEGER,
    "stockQty" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_redemptions" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "rewardId" INTEGER NOT NULL,
    "pointUsed" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "redeemCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_company_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "isPointEnabled" BOOLEAN NOT NULL DEFAULT true,
    "earnRatio" INTEGER NOT NULL DEFAULT 100,
    "pointExpiryMonths" INTEGER,
    "pointName" TEXT NOT NULL DEFAULT 'Point',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_company_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_wishlists" (
    "id" BIGSERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "com_wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "com_product_reviews" (
    "id" BIGSERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "comment" TEXT,
    "images" TEXT[],
    "replyMessage" TEXT,
    "repliedAt" TIMESTAMP(3),
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "com_product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_notifications" (
    "id" BIGSERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "recipientMemberId" INTEGER,
    "recipientUserId" INTEGER,
    "announcementId" INTEGER,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "iconUrl" TEXT,
    "actionUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpt_daily_sales" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "shopId" INTEGER,
    "date" DATE NOT NULL,
    "totalSales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netSales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rpt_daily_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpt_product_performance" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "shopId" INTEGER,
    "month" DATE NOT NULL,
    "totalSoldQty" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rpt_product_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_auth_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sec_company_auth_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "providerId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sec_company_auth_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "content" JSONB,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoImage" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_shifts" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "type" "ShiftType" NOT NULL DEFAULT 'WORK_DAY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_shift_details" (
    "id" SERIAL NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "previousShiftId" INTEGER,
    "boundaryStartTime" TEXT NOT NULL DEFAULT '00:00',
    "boundaryStartRel" "DayRelative" NOT NULL DEFAULT 'CURRENT',
    "boundaryEndTime" TEXT NOT NULL DEFAULT '00:00',
    "boundaryEndRel" "DayRelative" NOT NULL DEFAULT 'NEXT',
    "workStartTime" TEXT,
    "workStartRel" "DayRelative" NOT NULL DEFAULT 'CURRENT',
    "workEndTime" TEXT,
    "workEndRel" "DayRelative" NOT NULL DEFAULT 'CURRENT',
    "totalDayHours" DECIMAL(4,2) NOT NULL DEFAULT 8.0,
    "firstHalfHours" DECIMAL(4,2) NOT NULL DEFAULT 4.0,
    "secondHalfHours" DECIMAL(4,2) NOT NULL DEFAULT 4.0,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_shift_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_time_breaks" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "hr_time_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_shift_breaks" (
    "id" SERIAL NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "breakId" INTEGER NOT NULL,

    CONSTRAINT "hr_shift_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_calendars" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "hr_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_holidays" (
    "id" SERIAL NOT NULL,
    "calendarId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "hr_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_work_patterns" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cycleDays" INTEGER NOT NULL DEFAULT 7,

    CONSTRAINT "hr_work_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_work_pattern_items" (
    "id" SERIAL NOT NULL,
    "patternId" INTEGER NOT NULL,
    "dayOrder" INTEGER NOT NULL,
    "shiftId" INTEGER NOT NULL,

    CONSTRAINT "hr_work_pattern_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_schedules" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "isPublicHoliday" BOOLEAN NOT NULL DEFAULT false,
    "isDayOff" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "hr_employee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfg_rounding_rules" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoundingType" NOT NULL DEFAULT 'DIGIT',
    "digitIndex" INTEGER DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cfg_rounding_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfg_rounding_ranges" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "minVal" DECIMAL(18,6) NOT NULL,
    "maxVal" DECIMAL(18,6) NOT NULL,
    "result" DECIMAL(18,6) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cfg_rounding_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_types" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accrualType" "AccrualType" NOT NULL DEFAULT 'LUMP_SUM',
    "resetMonth" INTEGER NOT NULL DEFAULT 1,
    "allowedGender" "GenderRule" NOT NULL DEFAULT 'ALL',
    "isPaidLeave" BOOLEAN NOT NULL DEFAULT true,
    "canCarryOver" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryOverDays" DECIMAL(5,2),
    "maxCarryOverPercent" DECIMAL(5,2),
    "carryOverExpiryMonth" INTEGER,
    "minNoticeDays" INTEGER,
    "maxRetroactiveDays" INTEGER,
    "requiresFile" BOOLEAN NOT NULL DEFAULT false,
    "fileConditionDays" INTEGER NOT NULL DEFAULT 3,
    "roundingRule" "RoundingRule" NOT NULL DEFAULT 'ROUND_UP_HALF',
    "durationRule" "LeaveDurationRule" NOT NULL DEFAULT 'HALF_DAY_RESOLUTION',
    "includePublicHoliday" BOOLEAN NOT NULL DEFAULT false,
    "includeDayOff" BOOLEAN NOT NULL DEFAULT false,
    "canNegativeBalance" BOOLEAN NOT NULL DEFAULT false,
    "maxNegativeDays" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_entitlement_tiers" (
    "id" SERIAL NOT NULL,
    "leaveTypeId" INTEGER NOT NULL,
    "minServiceMonths" INTEGER NOT NULL,
    "maxServiceMonths" INTEGER,
    "quotaAmount" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "hr_leave_entitlement_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_substitutions" (
    "id" SERIAL NOT NULL,
    "leaveTypeId" INTEGER NOT NULL,
    "targetLeaveTypeId" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "deductRatio" DECIMAL(5,2) NOT NULL DEFAULT 1.0,

    CONSTRAINT "hr_leave_substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_balances" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "leaveTypeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "quotaAmount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "proRateAmount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "broughtForward" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalQuota" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "usedAmount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pendingAmount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "remaining" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_adjustments" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "leaveTypeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "amount" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_leave_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_requests" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "leaveTypeId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysCount" DECIMAL(5,2) NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "fileUrl" TEXT,
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfg_geographies" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT,
    "parentId" INTEGER,

    CONSTRAINT "cfg_geographies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfg_banks" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "color" TEXT,
    "logoUrl" TEXT,
    "officialCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cfg_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ComProductImageToComTag" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "sys_packages_code_key" ON "sys_packages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "org_companies_code_key" ON "org_companies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "org_company_infos_companyId_key" ON "org_company_infos"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "int_ai_bots_code_key" ON "int_ai_bots"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sys_modules_code_key" ON "sys_modules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "org_subscriptions_companyId_moduleId_key" ON "org_subscriptions"("companyId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "sec_users_username_key" ON "sec_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sec_users_email_key" ON "sec_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sec_users_googleId_key" ON "sec_users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "sec_users_facebookId_key" ON "sec_users"("facebookId");

-- CreateIndex
CREATE UNIQUE INDEX "sec_users_thaiId_key" ON "sec_users"("thaiId");

-- CreateIndex
CREATE UNIQUE INDEX "sec_users_paotangId_key" ON "sec_users"("paotangId");

-- CreateIndex
CREATE UNIQUE INDEX "sec_users_ndidId_key" ON "sec_users"("ndidId");

-- CreateIndex
CREATE UNIQUE INDEX "sec_roles_companyId_name_key" ON "sec_roles"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sec_permissions_resource_action_key" ON "sec_permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "sec_company_menu_configs_companyId_menuId_key" ON "sec_company_menu_configs"("companyId", "menuId");

-- CreateIndex
CREATE UNIQUE INDEX "sec_password_policies_companyId_key" ON "sec_password_policies"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "cfg_master_groups_groupCode_key" ON "cfg_master_groups"("groupCode");

-- CreateIndex
CREATE UNIQUE INDEX "cfg_master_data_masterGroupId_code_key" ON "cfg_master_data"("masterGroupId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cfg_running_formats_docCode_key" ON "cfg_running_formats"("docCode");

-- CreateIndex
CREATE UNIQUE INDEX "cfg_running_counters_formatId_periodKey_companyId_key" ON "cfg_running_counters"("formatId", "periodKey", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "cfg_system_configs_key_key" ON "cfg_system_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "com_templates_code_channel_locale_key" ON "com_templates"("code", "channel", "locale");

-- CreateIndex
CREATE INDEX "com_message_logs_companyId_channel_sentAt_idx" ON "com_message_logs"("companyId", "channel", "sentAt");

-- CreateIndex
CREATE INDEX "com_message_logs_refType_refId_idx" ON "com_message_logs"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employees_userId_key" ON "hr_employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employees_previousEmployeeId_key" ON "hr_employees"("previousEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employees_companyId_employeeCode_key" ON "hr_employees"("companyId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employee_infos_employeeId_key" ON "hr_employee_infos"("employeeId");

-- CreateIndex
CREATE INDEX "hr_employee_infos_companyId_idx" ON "hr_employee_infos"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_departments_companyId_code_key" ON "hr_departments"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_positions_companyId_code_key" ON "hr_positions"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "wf_definitions_code_key" ON "wf_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wf_definitions_companyId_code_key" ON "wf_definitions"("companyId", "code");

-- CreateIndex
CREATE INDEX "wf_requests_companyId_status_idx" ON "wf_requests"("companyId", "status");

-- CreateIndex
CREATE INDEX "wf_requests_businessId_businessType_idx" ON "wf_requests"("businessId", "businessType");

-- CreateIndex
CREATE INDEX "log_audits_companyId_tableName_recordId_idx" ON "log_audits"("companyId", "tableName", "recordId");

-- CreateIndex
CREATE INDEX "log_audits_companyId_userId_idx" ON "log_audits"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_members_companyId_lineUserId_key" ON "crm_members"("companyId", "lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "com_products_slug_key" ON "com_products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "com_products_companyId_sku_key" ON "com_products"("companyId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "sys_ai_model_configs_companyId_modelCode_key" ON "sys_ai_model_configs"("companyId", "modelCode");

-- CreateIndex
CREATE UNIQUE INDEX "com_tags_name_key" ON "com_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "com_discounts_companyId_code_key" ON "com_discounts"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "com_orders_companyId_orderNo_key" ON "com_orders"("companyId", "orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "com_order_items_wfRequestId_key" ON "com_order_items"("wfRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "com_payment_methods_companyId_code_key" ON "com_payment_methods"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "pro_suppliers_companyId_code_key" ON "pro_suppliers"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "pro_purchase_orders_companyId_docNo_key" ON "pro_purchase_orders"("companyId", "docNo");

-- CreateIndex
CREATE UNIQUE INDEX "com_shop_profiles_shopCode_key" ON "com_shop_profiles"("shopCode");

-- CreateIndex
CREATE UNIQUE INDEX "com_shop_profiles_companyId_shopCode_key" ON "com_shop_profiles"("companyId", "shopCode");

-- CreateIndex
CREATE UNIQUE INDEX "com_return_requests_wfRequestId_key" ON "com_return_requests"("wfRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "com_return_requests_companyId_docNo_key" ON "com_return_requests"("companyId", "docNo");

-- CreateIndex
CREATE INDEX "com_stock_logs_companyId_productId_createdAt_idx" ON "com_stock_logs"("companyId", "productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "int_ai_quotas_companyId_key" ON "int_ai_quotas"("companyId");

-- CreateIndex
CREATE INDEX "int_ai_usage_logs_companyId_createdAt_idx" ON "int_ai_usage_logs"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sec_company_security_configs_companyId_menuId_key" ON "sec_company_security_configs"("companyId", "menuId");

-- CreateIndex
CREATE INDEX "crm_point_logs_memberId_createdAt_idx" ON "crm_point_logs"("memberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "crm_company_configs_companyId_key" ON "crm_company_configs"("companyId");

-- CreateIndex
CREATE INDEX "com_wishlists_companyId_idx" ON "com_wishlists"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "com_wishlists_memberId_productId_key" ON "com_wishlists"("memberId", "productId");

-- CreateIndex
CREATE INDEX "com_product_reviews_productId_rating_idx" ON "com_product_reviews"("productId", "rating");

-- CreateIndex
CREATE INDEX "sys_notifications_recipientMemberId_isRead_idx" ON "sys_notifications"("recipientMemberId", "isRead");

-- CreateIndex
CREATE INDEX "sys_notifications_recipientUserId_isRead_idx" ON "sys_notifications"("recipientUserId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "rpt_daily_sales_companyId_shopId_date_key" ON "rpt_daily_sales"("companyId", "shopId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "rpt_product_performance_companyId_productId_shopId_month_key" ON "rpt_product_performance"("companyId", "productId", "shopId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "sec_company_auth_configs_companyId_providerId_key" ON "sec_company_auth_configs"("companyId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_companyId_slug_key" ON "cms_pages"("companyId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "hr_shifts_companyId_code_key" ON "hr_shifts"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_shift_details_shiftId_previousShiftId_key" ON "hr_shift_details"("shiftId", "previousShiftId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_work_pattern_items_patternId_dayOrder_key" ON "hr_work_pattern_items"("patternId", "dayOrder");

-- CreateIndex
CREATE INDEX "hr_employee_schedules_date_idx" ON "hr_employee_schedules"("date");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employee_schedules_employeeId_date_key" ON "hr_employee_schedules"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "cfg_rounding_rules_companyId_code_key" ON "cfg_rounding_rules"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_leave_types_companyId_code_key" ON "hr_leave_types"("companyId", "code");

-- CreateIndex
CREATE INDEX "hr_leave_substitutions_leaveTypeId_priority_idx" ON "hr_leave_substitutions"("leaveTypeId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "hr_leave_substitutions_leaveTypeId_targetLeaveTypeId_key" ON "hr_leave_substitutions"("leaveTypeId", "targetLeaveTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_leave_balances_employeeId_leaveTypeId_year_key" ON "hr_leave_balances"("employeeId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "hr_leave_adjustments_employeeId_leaveTypeId_year_idx" ON "hr_leave_adjustments"("employeeId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "hr_leave_requests_employeeId_startDate_idx" ON "hr_leave_requests"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "cfg_geographies_type_idx" ON "cfg_geographies"("type");

-- CreateIndex
CREATE INDEX "cfg_geographies_parentId_idx" ON "cfg_geographies"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "cfg_banks_code_key" ON "cfg_banks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "_ComProductImageToComTag_AB_unique" ON "_ComProductImageToComTag"("A", "B");

-- CreateIndex
CREATE INDEX "_ComProductImageToComTag_B_index" ON "_ComProductImageToComTag"("B");

-- AddForeignKey
ALTER TABLE "sys_package_modules" ADD CONSTRAINT "sys_package_modules_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "sys_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_package_modules" ADD CONSTRAINT "sys_package_modules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "sys_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_companies" ADD CONSTRAINT "org_companies_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "sys_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_companies" ADD CONSTRAINT "org_companies_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "org_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_companies" ADD CONSTRAINT "org_companies_licenseHolderId_fkey" FOREIGN KEY ("licenseHolderId") REFERENCES "org_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_company_infos" ADD CONSTRAINT "org_company_infos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_cloud_configs" ADD CONSTRAINT "int_cloud_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_ai_bots" ADD CONSTRAINT "int_ai_bots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_knowledge_bases" ADD CONSTRAINT "int_knowledge_bases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_line_configs" ADD CONSTRAINT "int_line_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_line_configs" ADD CONSTRAINT "int_line_configs_aiBotId_fkey" FOREIGN KEY ("aiBotId") REFERENCES "int_ai_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_facebook_pages" ADD CONSTRAINT "int_facebook_pages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_facebook_pages" ADD CONSTRAINT "int_facebook_pages_aiBotId_fkey" FOREIGN KEY ("aiBotId") REFERENCES "int_ai_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "sys_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_roles" ADD CONSTRAINT "sec_roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_user_roles" ADD CONSTRAINT "sec_user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sec_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_user_roles" ADD CONSTRAINT "sec_user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "sec_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_user_roles" ADD CONSTRAINT "sec_user_roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_permissions" ADD CONSTRAINT "sec_permissions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "sys_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_role_permissions" ADD CONSTRAINT "sec_role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "sec_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_role_permissions" ADD CONSTRAINT "sec_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "sec_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_menus" ADD CONSTRAINT "sec_menus_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sec_menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_menus" ADD CONSTRAINT "sec_menus_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "sys_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_company_menu_configs" ADD CONSTRAINT "sec_company_menu_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_company_menu_configs" ADD CONSTRAINT "sec_company_menu_configs_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "sec_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_role_menus" ADD CONSTRAINT "sec_role_menus_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "sec_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_role_menus" ADD CONSTRAINT "sec_role_menus_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "sec_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_password_policies" ADD CONSTRAINT "sec_password_policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_user_delegations" ADD CONSTRAINT "sec_user_delegations_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "sec_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_user_delegations" ADD CONSTRAINT "sec_user_delegations_delegateUserId_fkey" FOREIGN KEY ("delegateUserId") REFERENCES "sec_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfg_master_data" ADD CONSTRAINT "cfg_master_data_masterGroupId_fkey" FOREIGN KEY ("masterGroupId") REFERENCES "cfg_master_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfg_master_data" ADD CONSTRAINT "cfg_master_data_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "cfg_master_data"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfg_running_counters" ADD CONSTRAINT "cfg_running_counters_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "cfg_running_formats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_message_logs" ADD CONSTRAINT "com_message_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sec_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_previousEmployeeId_fkey" FOREIGN KEY ("previousEmployeeId") REFERENCES "hr_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "hr_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "hr_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "hr_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_workPatternId_fkey" FOREIGN KEY ("workPatternId") REFERENCES "hr_work_patterns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_infos" ADD CONSTRAINT "hr_employee_infos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_infos" ADD CONSTRAINT "hr_employee_infos_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employment_periods" ADD CONSTRAINT "hr_employment_periods_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_departments" ADD CONSTRAINT "hr_departments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_departments" ADD CONSTRAINT "hr_departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "hr_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_positions" ADD CONSTRAINT "hr_positions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_job_history" ADD CONSTRAINT "hr_job_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_job_history" ADD CONSTRAINT "hr_job_history_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "hr_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_job_history" ADD CONSTRAINT "hr_job_history_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "hr_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_definitions" ADD CONSTRAINT "wf_definitions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_nodes" ADD CONSTRAINT "wf_nodes_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "wf_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_nodes" ADD CONSTRAINT "wf_nodes_approverRoleId_fkey" FOREIGN KEY ("approverRoleId") REFERENCES "sec_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_nodes" ADD CONSTRAINT "wf_nodes_approverPositionId_fkey" FOREIGN KEY ("approverPositionId") REFERENCES "hr_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_nodes" ADD CONSTRAINT "wf_nodes_nextApproveId_fkey" FOREIGN KEY ("nextApproveId") REFERENCES "wf_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_nodes" ADD CONSTRAINT "wf_nodes_nextRejectId_fkey" FOREIGN KEY ("nextRejectId") REFERENCES "wf_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_requests" ADD CONSTRAINT "wf_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_requests" ADD CONSTRAINT "wf_requests_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "wf_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_requests" ADD CONSTRAINT "wf_requests_currentNodeId_fkey" FOREIGN KEY ("currentNodeId") REFERENCES "wf_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_requests" ADD CONSTRAINT "wf_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "sec_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_actions" ADD CONSTRAINT "wf_actions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "wf_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_actions" ADD CONSTRAINT "wf_actions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "sec_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_audits" ADD CONSTRAINT "log_audits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_audits" ADD CONSTRAINT "log_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sec_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_members" ADD CONSTRAINT "crm_members_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_addresses" ADD CONSTRAINT "crm_addresses_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "crm_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_products" ADD CONSTRAINT "com_products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_products" ADD CONSTRAINT "com_products_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sec_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_products" ADD CONSTRAINT "com_products_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "pro_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_products" ADD CONSTRAINT "com_products_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "com_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_product_images" ADD CONSTRAINT "com_product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "com_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_product_images" ADD CONSTRAINT "com_product_images_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "com_product_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_product_images" ADD CONSTRAINT "com_product_images_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "com_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_ai_batch_jobs" ADD CONSTRAINT "int_ai_batch_jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_ai_model_configs" ADD CONSTRAINT "sys_ai_model_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_product_price_sets" ADD CONSTRAINT "com_product_price_sets_productId_fkey" FOREIGN KEY ("productId") REFERENCES "com_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_product_tier_prices" ADD CONSTRAINT "com_product_tier_prices_priceSetId_fkey" FOREIGN KEY ("priceSetId") REFERENCES "com_product_price_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_discounts" ADD CONSTRAINT "com_discounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_shipping_methods" ADD CONSTRAINT "com_shipping_methods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_shipping_rules" ADD CONSTRAINT "com_shipping_rules_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "com_shipping_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_announcements" ADD CONSTRAINT "com_announcements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_orders" ADD CONSTRAINT "com_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_orders" ADD CONSTRAINT "com_orders_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "crm_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_orders" ADD CONSTRAINT "com_orders_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "com_shop_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_orders" ADD CONSTRAINT "com_orders_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "com_discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_order_items" ADD CONSTRAINT "com_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "com_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_order_items" ADD CONSTRAINT "com_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "com_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_order_items" ADD CONSTRAINT "com_order_items_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "pro_purchase_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_order_items" ADD CONSTRAINT "com_order_items_wfRequestId_fkey" FOREIGN KEY ("wfRequestId") REFERENCES "wf_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_payment_methods" ADD CONSTRAINT "com_payment_methods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_payments" ADD CONSTRAINT "com_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_payments" ADD CONSTRAINT "com_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "com_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_payments" ADD CONSTRAINT "com_payments_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "com_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_payments" ADD CONSTRAINT "com_payments_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "sec_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_suppliers" ADD CONSTRAINT "pro_suppliers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_purchase_orders" ADD CONSTRAINT "pro_purchase_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_purchase_orders" ADD CONSTRAINT "pro_purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "pro_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_purchase_items" ADD CONSTRAINT "pro_purchase_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "pro_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_purchase_items" ADD CONSTRAINT "pro_purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "com_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_shop_profiles" ADD CONSTRAINT "com_shop_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_bank_accounts" ADD CONSTRAINT "com_bank_accounts_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "com_shop_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_shop_products" ADD CONSTRAINT "com_shop_products_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "com_shop_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_shop_products" ADD CONSTRAINT "com_shop_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "com_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_return_requests" ADD CONSTRAINT "com_return_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_return_requests" ADD CONSTRAINT "com_return_requests_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "com_shop_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_return_requests" ADD CONSTRAINT "com_return_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "com_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_return_requests" ADD CONSTRAINT "com_return_requests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "crm_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_return_requests" ADD CONSTRAINT "com_return_requests_wfRequestId_fkey" FOREIGN KEY ("wfRequestId") REFERENCES "wf_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_return_items" ADD CONSTRAINT "com_return_items_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "com_return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_return_items" ADD CONSTRAINT "com_return_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "com_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_return_items" ADD CONSTRAINT "com_return_items_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "com_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_stock_logs" ADD CONSTRAINT "com_stock_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_stock_logs" ADD CONSTRAINT "com_stock_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "com_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_ai_quotas" ADD CONSTRAINT "int_ai_quotas_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_ai_usage_logs" ADD CONSTRAINT "int_ai_usage_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_ai_usage_logs" ADD CONSTRAINT "int_ai_usage_logs_aiBotId_fkey" FOREIGN KEY ("aiBotId") REFERENCES "int_ai_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_company_security_configs" ADD CONSTRAINT "sec_company_security_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_company_security_configs" ADD CONSTRAINT "sec_company_security_configs_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "sec_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_point_logs" ADD CONSTRAINT "crm_point_logs_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "crm_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_rewards" ADD CONSTRAINT "crm_rewards_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_redemptions" ADD CONSTRAINT "crm_redemptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_redemptions" ADD CONSTRAINT "crm_redemptions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "crm_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_redemptions" ADD CONSTRAINT "crm_redemptions_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "crm_rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_company_configs" ADD CONSTRAINT "crm_company_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_wishlists" ADD CONSTRAINT "com_wishlists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_wishlists" ADD CONSTRAINT "com_wishlists_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "crm_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_wishlists" ADD CONSTRAINT "com_wishlists_productId_fkey" FOREIGN KEY ("productId") REFERENCES "com_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_product_reviews" ADD CONSTRAINT "com_product_reviews_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_product_reviews" ADD CONSTRAINT "com_product_reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "com_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_product_reviews" ADD CONSTRAINT "com_product_reviews_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "crm_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_product_reviews" ADD CONSTRAINT "com_product_reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "com_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_notifications" ADD CONSTRAINT "sys_notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_notifications" ADD CONSTRAINT "sys_notifications_recipientMemberId_fkey" FOREIGN KEY ("recipientMemberId") REFERENCES "crm_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_notifications" ADD CONSTRAINT "sys_notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "sec_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_notifications" ADD CONSTRAINT "sys_notifications_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "com_announcements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpt_daily_sales" ADD CONSTRAINT "rpt_daily_sales_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpt_daily_sales" ADD CONSTRAINT "rpt_daily_sales_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "com_shop_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpt_product_performance" ADD CONSTRAINT "rpt_product_performance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpt_product_performance" ADD CONSTRAINT "rpt_product_performance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "com_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_company_auth_configs" ADD CONSTRAINT "sec_company_auth_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_company_auth_configs" ADD CONSTRAINT "sec_company_auth_configs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "sys_auth_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_shift_details" ADD CONSTRAINT "hr_shift_details_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "hr_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_shift_details" ADD CONSTRAINT "hr_shift_details_previousShiftId_fkey" FOREIGN KEY ("previousShiftId") REFERENCES "hr_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_shift_breaks" ADD CONSTRAINT "hr_shift_breaks_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "hr_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_shift_breaks" ADD CONSTRAINT "hr_shift_breaks_breakId_fkey" FOREIGN KEY ("breakId") REFERENCES "hr_time_breaks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_holidays" ADD CONSTRAINT "hr_holidays_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "hr_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_work_pattern_items" ADD CONSTRAINT "hr_work_pattern_items_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "hr_work_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_work_pattern_items" ADD CONSTRAINT "hr_work_pattern_items_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "hr_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_schedules" ADD CONSTRAINT "hr_employee_schedules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_schedules" ADD CONSTRAINT "hr_employee_schedules_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "hr_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfg_rounding_rules" ADD CONSTRAINT "cfg_rounding_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfg_rounding_ranges" ADD CONSTRAINT "cfg_rounding_ranges_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "cfg_rounding_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_types" ADD CONSTRAINT "hr_leave_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_entitlement_tiers" ADD CONSTRAINT "hr_leave_entitlement_tiers_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "hr_leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_substitutions" ADD CONSTRAINT "hr_leave_substitutions_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "hr_leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_substitutions" ADD CONSTRAINT "hr_leave_substitutions_targetLeaveTypeId_fkey" FOREIGN KEY ("targetLeaveTypeId") REFERENCES "hr_leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_balances" ADD CONSTRAINT "hr_leave_balances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_balances" ADD CONSTRAINT "hr_leave_balances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_balances" ADD CONSTRAINT "hr_leave_balances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "hr_leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_adjustments" ADD CONSTRAINT "hr_leave_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_adjustments" ADD CONSTRAINT "hr_leave_adjustments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_adjustments" ADD CONSTRAINT "hr_leave_adjustments_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "hr_leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_requests" ADD CONSTRAINT "hr_leave_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_requests" ADD CONSTRAINT "hr_leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_requests" ADD CONSTRAINT "hr_leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "hr_leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfg_geographies" ADD CONSTRAINT "cfg_geographies_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "cfg_geographies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ComProductImageToComTag" ADD CONSTRAINT "_ComProductImageToComTag_A_fkey" FOREIGN KEY ("A") REFERENCES "com_product_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ComProductImageToComTag" ADD CONSTRAINT "_ComProductImageToComTag_B_fkey" FOREIGN KEY ("B") REFERENCES "com_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
