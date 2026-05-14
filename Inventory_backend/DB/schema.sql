-- Inventory System Database Schema
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE `auth_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `mobile` varchar(15) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `role` varchar(20) DEFAULT 'user',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `mobile` (`mobile`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `employee_id` varchar(50) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `sub_role` varchar(100) DEFAULT NULL,
  `added_by` int DEFAULT NULL,
  `auth_user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_users_auth_user_id` (`auth_user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=106 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inventories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `details` text,
  `custom_columns` json DEFAULT NULL COMMENT 'Admin-defined asset field labels',
  `asset_count` int unsigned NOT NULL DEFAULT '0',
  `asset_names` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_type` varchar(50) DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `cpu` varchar(100) DEFAULT NULL,
  `ram` varchar(50) DEFAULT NULL,
  `storage` varchar(50) DEFAULT NULL,
  `custom_fields` json DEFAULT NULL COMMENT 'Values for inventory custom column labels',
  `status` varchar(50) DEFAULT 'Available',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `inventory_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `serial_number` (`serial_number`),
  KEY `idx_assets_inventory_id` (`inventory_id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `asset_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int DEFAULT NULL,
  `event_type` varchar(50) DEFAULT NULL,
  `event_timestamp` datetime DEFAULT NULL,
  `assignment_id` int DEFAULT NULL,
  `repair_id` int DEFAULT NULL,
  `disposed_item_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `user_name` varchar(100) DEFAULT NULL,
  `employee_id` varchar(64) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `working_minutes` int DEFAULT NULL,
  `condition_before` varchar(100) DEFAULT NULL,
  `condition_after` varchar(100) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `asset_type` varchar(50) DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `cpu` varchar(100) DEFAULT NULL,
  `ram` varchar(50) DEFAULT NULL,
  `storage` varchar(50) DEFAULT NULL,
  `issue_notes` text,
  `inventory_id` int DEFAULT NULL,
  `inventory_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_asset` (`asset_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=76 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `asset_id` int DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `working_minutes` int DEFAULT NULL,
  `condition_before` varchar(100) DEFAULT NULL,
  `condition_after` varchar(100) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Active',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `asset_id` (`asset_id`),
  CONSTRAINT `assignments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `assignments_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=65 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `repairs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int DEFAULT NULL,
  `issue` text,
  `status` varchar(50) DEFAULT NULL,
  `reported_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `added_by` int DEFAULT NULL,
  `repair_cost` decimal(12,2) DEFAULT NULL,
  `repair_notes` text,
  `fixed_at` datetime DEFAULT NULL,
  `repair_bill` varchar(512) DEFAULT NULL,
  `assigned_authority_auth_user_id` int DEFAULT NULL,
  `authority_resolution` text,
  `authority_updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `asset_id` (`asset_id`),
  CONSTRAINT `repairs_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `disposed_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `former_asset_id` int NOT NULL,
  `inventory_id` int DEFAULT NULL,
  `inventory_name` varchar(255) DEFAULT NULL,
  `asset_type` varchar(255) NOT NULL,
  `brand` varchar(255) NOT NULL,
  `model` varchar(255) NOT NULL,
  `serial_number` varchar(255) DEFAULT NULL,
  `assignment_id` int DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `employee_id` varchar(64) DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `condition_after` varchar(255) DEFAULT NULL,
  `notes` text,
  `disposed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_disposed_at` (`disposed_at`),
  KEY `idx_inventory_id` (`inventory_id`),
  KEY `idx_former_asset` (`former_asset_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `asset_id` int DEFAULT NULL,
  `assigned_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `asset_id` (`asset_id`),
  CONSTRAINT `user_assets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `user_assets_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `assignment_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `auth_user_id` int NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'Pending',
  `user_message` text,
  `admin_note` text,
  `fulfillment_notice` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ar_auth` (`auth_user_id`),
  KEY `idx_ar_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `assignment_request_asset_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `asset_type` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_art_req` (`request_id`),
  CONSTRAINT `fk_art_req` FOREIGN KEY (`request_id`) REFERENCES `assignment_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `assignment_request_inventories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `inventory_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ari2_req` (`request_id`),
  CONSTRAINT `fk_ari2_req` FOREIGN KEY (`request_id`) REFERENCES `assignment_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `assignment_request_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `asset_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ari_req` (`request_id`),
  CONSTRAINT `fk_ari_req` FOREIGN KEY (`request_id`) REFERENCES `assignment_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS=1;
