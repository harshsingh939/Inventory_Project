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
-- Table structure for table `repairs`
--

DROP TABLE IF EXISTS `repairs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `repairs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int DEFAULT NULL,
  `issue` text,
  `status` varchar(50) DEFAULT NULL,
  `reported_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `assigned_authority_auth_user_id` int DEFAULT NULL,
  `authority_resolution` text,
  `authority_updated_at` datetime DEFAULT NULL,
  `repair_cost` decimal(12,2) DEFAULT NULL,
  `repair_notes` text,
  `fixed_at` datetime DEFAULT NULL,
  `repair_bill` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `asset_id` (`asset_id`),
  CONSTRAINT `repairs_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `repairs`
--

LOCK TABLES `repairs` WRITE;
/*!40000 ALTER TABLE `repairs` DISABLE KEYS */;
INSERT INTO `repairs` VALUES (1,1,'Motherboard issue','Fixed','2026-04-03 12:19:33',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(2,1,'Motherboard issue','Fixed','2026-04-03 12:19:38',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(3,1,'Motherboard issue','Fixed','2026-04-03 12:19:38',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(4,1,'Motherboard issue','In Progress','2026-04-03 12:19:39',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(5,1,'Motherboard issue','Fixed','2026-04-03 12:19:39',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(6,1,'Motherboard issue','Pending','2026-04-03 12:19:39',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(7,1,'Motherboard issue','Pending','2026-04-03 12:19:39',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(8,1,'Motherboard issue','Pending','2026-04-03 12:19:39',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(9,1,'kjfjef','Pending','2026-04-03 12:22:47',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(10,1,'kjfjef','Fixed','2026-04-03 12:22:56',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(11,1,'kjfjef','Fixed','2026-04-03 12:22:57',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(12,1,'kjfjef','In Progress','2026-04-03 12:22:57',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(13,2,'not working properly','Fixed','2026-04-29 13:36:44',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(16,1,'monitor issue','Pending','2026-05-01 15:02:48',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(17,2,'cpu issue','Fixed','2026-05-01 15:50:06',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(18,1,'os crashed','Pending','2026-05-04 17:25:02',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(19,7,'screen not displaying','Fixed','2026-05-04 17:42:26',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(20,2,'system very slow','Pending','2026-05-04 17:43:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(21,1,'hanging issue','Pending','2026-05-04 17:44:33',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(22,4,'window not working properly','Pending','2026-05-06 09:34:51',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(23,1,'overheating','Pending','2026-05-06 09:36:54',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(24,1,'USB is not detecting','Pending','2026-05-06 09:47:22',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(25,4,'screen flickering','Pending','2026-05-06 09:53:10',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(26,4,'laptop not turning on','Pending','2026-05-06 09:57:20',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(27,1,'hgjfjf','Pending','2026-05-06 10:00:46',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(28,2,'cgsfs','Pending','2026-05-06 10:06:05',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(29,1,'hjgwqkhd','Pending','2026-05-06 10:17:09',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(30,1,'scddz','Pending','2026-05-06 10:21:09',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(31,4,'mjgk','Pending','2026-05-06 10:26:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(32,2,'zccvzvz','Pending','2026-05-06 10:32:33',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(33,2,'safffa','Pending','2026-05-06 10:33:07',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(34,8,'fuction key not working properly','Pending','2026-05-11 11:10:24',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(35,8,'caps lock key not getting on','Pending','2026-05-11 11:11:02',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `repairs` ENABLE KEYS */;
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
