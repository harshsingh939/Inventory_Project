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
-- Table structure for table `assets`
--

DROP TABLE IF EXISTS `assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_type` varchar(50) DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `cpu` varchar(100) DEFAULT NULL,
  `ram` varchar(50) DEFAULT NULL,
  `storage` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Available',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `inventory_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `serial_number` (`serial_number`),
  KEY `idx_assets_inventory_id` (`inventory_id`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assets`
--

LOCK TABLES `assets` WRITE;
/*!40000 ALTER TABLE `assets` DISABLE KEYS */;
INSERT INTO `assets` VALUES (1,'Desktop','Samamsung','EliteBook','HP001','i7','12GB','512GB SSD','Under Repair','2026-03-28 08:45:04',NULL),(2,'Desktop','HP','Pavilion','SN235','i7','16','512 SSD','Under Repair','2026-04-02 11:50:47',NULL),(4,'Laptop','acer','Elitebook','SN238','i3','8GB','256GB','Under Repair','2026-04-03 05:51:23',NULL),(7,'Workstation','Dell','Z series','98765','','16gb','512gb','Available','2026-05-01 09:40:42',NULL),(8,'Laptop','dell','del5','543','i5','16GB','256SSD','Under Repair','2026-05-06 09:28:43',2),(9,'Laptop','HP','latitude','ABC1234','i3','16GB','256SSD','Assigned','2026-05-06 09:37:32',2),(10,'Webcam','Logitech','C270','WC123456','','','','Assigned','2026-05-06 09:39:30',3),(11,'IP Camera','Hikvision','DS-2CD1023G0E','IPC001','','','','Available','2026-05-06 09:40:16',3),(12,'CCTV Camera','CP Plus','CP-UNC-DA21L3','CCTV001','','','','Available','2026-05-06 09:40:57',3),(13,'Laptop','Lenovo','Pavilion 15','LTP002','i7','16GB','512GB SSD','Assigned','2026-05-06 09:43:59',2),(14,'Desktop','HP','ProDesk 400','DSK002','i5','16GB','512GB SSD','Assigned','2026-05-06 09:45:04',2),(15,'Workstation',' Dell','Precision 3640','WKS001','i9',' 32GB',' 1TB SSD','Assigned','2026-05-06 09:47:17',2),(16,'System','HP','Z2 Tower G5','WKS002','Xeon','32GB','1TB SSD','Available','2026-05-06 09:47:56',2),(17,'Webcam','logitech','C280','WC003','','','','Available','2026-05-06 10:18:46',3),(18,'HDMI Cable','AmazonBasics','High-Speed HDMI 1.5m','HDMI001','','','','Available','2026-05-06 10:21:05',8),(19,'Extension Board','Syska','EB-204','EXT-001','','','','Available','2026-05-06 11:30:01',4),(20,'UPS','APC','BX600C','UPS-001','','','','Assigned','2026-05-06 11:30:29',4),(21,'Extension Board','HP','65W Adapter','CHG-001','','','','Assigned','2026-05-06 11:33:55',4),(22,'Power Strip','Zebronics','ZEB-PS100','PS-001','','','','Available','2026-05-06 11:34:53',4),(23,'Router','Netgear','Archer C6','RTR-001','','','','Available','2026-05-06 11:36:09',5),(24,'Switch','TP-Link','TL-SG105','SW-001','','','','Available','2026-05-06 11:36:38',5),(25,'Access Point','Ubiquiti','EAP225','AP-001','','','','Available','2026-05-06 11:37:10',5),(26,'Firewall','Fortinet','FortiGate 40F','FW-001','','','','Available','2026-05-06 11:37:33',5),(27,'NAS','Synology','DS220+','NAS-001','','','','Available','2026-05-06 11:37:55',5),(28,'Keyboard','Logitech','K120','KB-001','','','','Available','2026-05-06 11:40:04',6),(29,'Mouse','Dell','Wireless Mouse','MS-001','','','','Assigned','2026-05-06 11:40:29',6),(30,'Headset','Boat','BassHeads 900','HS-001','','','','Available','2026-05-06 11:41:01',6),(31,'Speaker','Zebronics','Zeb-County','SP-001','','','','Available','2026-05-06 11:41:28',6),(32,'USB Hub','SanDisk','32GB','USB-001','','','','Available','2026-05-06 11:41:58',6),(33,'Microphone','Boya','BY-M1','MIC-001','','','','Available','2026-05-06 11:42:21',6),(34,'Printer','Canon','LaserJet Pro M126nw','PRN-001','','','','Assigned','2026-05-06 11:43:07',7),(35,'Scanner','Epson','CanoScan LiDE 300','SCN-001','','','','Assigned','2026-05-06 11:43:34',7),(36,'Projector','BenQ','MX535','PRJ-001','','','','Assigned','2026-05-06 11:43:56',7),(37,'Desk','Generic','4ft Table','DK-001','','','','Available','2026-05-06 11:44:36',9),(38,'Tablet Stand','Portronics','Flexi','TAB-09','','','','Available','2026-05-11 05:26:05',10),(39,'Laptop Bag','Dell','Pro Sleeve','BAG-14','','','','Available','2026-05-11 05:26:39',10);
/*!40000 ALTER TABLE `assets` ENABLE KEYS */;
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
