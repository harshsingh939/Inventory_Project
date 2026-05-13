-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: inventory_system
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `assignment_requests`
--

DROP TABLE IF EXISTS `assignment_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assignment_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `auth_user_id` int NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'Pending',
  `user_message` text,
  `admin_note` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ar_auth` (`auth_user_id`),
  KEY `idx_ar_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assignment_requests`
--

LOCK TABLES `assignment_requests` WRITE;
/*!40000 ALTER TABLE `assignment_requests` DISABLE KEYS */;
INSERT INTO `assignment_requests` VALUES (2,11,'Fulfilled',NULL,NULL,'2026-05-06 14:29:37','2026-05-06 14:29:55'),(3,11,'Fulfilled',NULL,NULL,'2026-05-06 14:49:06','2026-05-06 14:49:15'),(4,11,'Rejected',NULL,NULL,'2026-05-06 14:53:33','2026-05-06 15:00:34'),(5,11,'Rejected','keyboard',NULL,'2026-05-11 10:44:04','2026-05-11 11:00:49'),(6,11,'Rejected',NULL,NULL,'2026-05-11 10:48:50','2026-05-11 11:00:30'),(7,11,'Pending',NULL,NULL,'2026-05-11 12:22:52',NULL),(8,12,'Pending',NULL,NULL,'2026-05-11 12:28:53',NULL),(9,11,'Pending',NULL,NULL,'2026-05-11 12:35:43',NULL),(10,7,'Pending',NULL,NULL,'2026-05-11 12:40:03',NULL),(11,8,'Pending',NULL,NULL,'2026-05-11 12:44:03',NULL),(12,11,'Pending',NULL,NULL,'2026-05-11 12:56:11',NULL),(13,11,'Pending',NULL,NULL,'2026-05-11 12:59:53',NULL),(14,11,'Fulfilled','mouse',NULL,'2026-05-11 13:03:27','2026-05-11 14:08:04');
/*!40000 ALTER TABLE `assignment_requests` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-13 12:12:47
